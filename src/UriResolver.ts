import { 
    IResolver,
    LOCALHOST,
    FS_PROTO,
    URI
} from "./helpers/constant";
import HttpResolver from "./resolvers/HttpResolver";
import FileSystemResolver from "./resolvers/FileSystemResolver";
import Media from "./Media";
import { isObjectLiteral } from "./helpers/util";
import { 
    normalizeJsonLdId,
    isImageFile
} from "./helpers/data";
import {
    JSONLD_CONTEXT,
    JSONLD_GRAPH,
    JSONLD_ID,
    JSONLD_TYPE,
    isSchemaType,
    isJsonLdRef,
    parseUri
} from "sambal-jsonld";

type UriMatcher = {
    protocol?: string | string[],
    host?: string | string[],
    path?: string | string[]
}

const IMAGE_OBJECT = "imageobject";
const MAX_DEPTH = 100;

export default class UriResolver {
    // private blankNodeIndex: number;
    private fsResolver: FileSystemResolver;
    private httpResolver: HttpResolver;
    private resolvers: {
        matcher: UriMatcher,
        resolver: IResolver
    }[];

    constructor(
        pages: string[],
        data: string[],
        private media: Media
    ) {
        // this.blankNodeIndex = 1;
        this.fsResolver = new FileSystemResolver(pages, data);
        this.httpResolver = new HttpResolver();
        this.resolvers = [
            {
                matcher: {protocol: `${FS_PROTO}:`},
                resolver: this.fsResolver
            },
            {
                matcher: {protocol: ["https:", "http:"]},
                resolver: this.httpResolver
            }
        ];
    }

    addResolver(matcher: UriMatcher, resolver: IResolver) {
        this.resolvers.unshift({
            matcher,
            resolver
        });
    }

    clearCache() {
        for (const instance of this.resolvers) {
            instance.resolver.clearCache();
        }
    }

    async tryLoadLocalUri(localUri: string) {
        return await this.fsResolver.tryLoadLocalUri(localUri);
    }

    async resolveUri(uriStr: string) {
        const uriObj: URI = parseUri(uriStr) as URI;
        // Fill in protocol and host for relative path
        if (!uriObj.protocol && !uriObj.host) {
            uriObj.protocol = `${FS_PROTO}:`;
            uriObj.host = LOCALHOST;
        }

        let data;
        for (const instance of this.resolvers) {
            if (this.isMatch(instance.matcher, uriObj)) {
                data = await instance.resolver.resolveUri(uriObj);
                break;
            }
        }
        if (!data) {
            throw new Error(`No resolver found for uri ${uriStr}`);
        }
        if (this.fsResolver.isLocalImageFile(uriObj.path) || isImageFile(uriStr)) {
            data = await this.media.loadImageUrl(uriObj.path, data);
        } else if (isSchemaType(data, IMAGE_OBJECT, false)) {
            const normalizedUrl = normalizeJsonLdId(data.contentUrl);
            const image = await this.resolveUri(normalizedUrl);
            data = {
                ...data,
                ...await this.media.loadImageUrl(normalizedUrl, image)
            };
        }
        return data;
    }

    private isMatch(matcher: UriMatcher, uri: URI) {
        return this.matcher(matcher.protocol, uri.protocol) &&
            this.matcher(matcher.host, uri.host) &&
            this.matcher(matcher.path, uri.path);
    }

    private matcher(expect: string | string[] | undefined, actual: string) {
        if (!expect) {
            return true;
        }
        return Array.isArray(expect) ? expect.indexOf(actual) >= 0 : expect === actual;
    }

    async hydrateUri(uri: string) {
        let jsonld = await this.resolveUri(uri);
        this.ensureJsonLd(jsonld, normalizeJsonLdId(uri));
        jsonld = await this.hydrate(jsonld);
        return jsonld;
    }

    // all data need @id and @type
    private async ensureJsonLd(jsonld: any, impliedId: string) {
        if (Array.isArray(jsonld)) {
            return;
        }
        if (!jsonld[JSONLD_ID]) {
            // jsonld[JSONLD_ID] = impliedId ? impliedId : `_:${this.blankNodeIndex++}`;
            jsonld[JSONLD_ID] = impliedId;
        }
    }

    async hydrate(
        target: unknown,
        level: number = 1,
        graph?: Map<string, unknown>
    ) {
        if (level > MAX_DEPTH) {
            throw new Error("Hydrating jsonld exceeded max depth level");
        }
        const nextLevel = level + 1;
        if (Array.isArray(target)) {
            const resolvedArr = [];
            for (const item of target) {
                resolvedArr.push(
                    await this.hydrate(item, nextLevel, graph)
                );
            }
            return resolvedArr;
        } else if (isJsonLdRef(target)) {
            let nextTarget;
            if (graph && graph.has(target[JSONLD_ID])) {
                nextTarget = graph.get(target[JSONLD_ID]);
            } else {
                const uri = normalizeJsonLdId(target[JSONLD_ID]);
                nextTarget = await this.resolveUri(uri);
                this.ensureJsonLd(nextTarget, uri);
            }
            return await this.hydrate(
                nextTarget,
                nextLevel,
                graph
            );
        } else if (isObjectLiteral(target)) {
            // this.ensureJsonLd(target);
            await this.iterateObjectKeys(target, nextLevel, graph);
        }
        return target;
    }

    private async iterateObjectKeys(
        target: unknown,
        level: number,
        graph?: Map<string, unknown>
    ) {
        let objectGraph = null;
        for (const fieldName of Object.keys(target)) {
            if (fieldName !== JSONLD_ID && fieldName !== JSONLD_TYPE && fieldName !== JSONLD_CONTEXT) {
                const fieldValue = target[fieldName];
                if (fieldName === JSONLD_GRAPH) {
                    objectGraph = this.getGraphContext(fieldValue);
                }
                target[fieldName] = await this.hydrate(
                    fieldValue,
                    level,
                    objectGraph ? objectGraph : graph
                );
            }
        }
    }

    private getGraphContext(graph: any[]) {
        const context = new Map<string, unknown>();
        for (const item of graph) {
            context.set(item[JSONLD_ID], item);
        }
        return context;
    }
}