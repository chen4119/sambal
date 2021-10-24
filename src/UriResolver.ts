import { 
    IResolver,
    LOCALHOST,
    FILE_PROTOCOL,
    URI,
    Collection
} from "./helpers/constant";
import HttpResolver from "./resolvers/HttpResolver";
import FileSystemResolver from "./resolvers/FileSystemResolver";
import CollectionResolver from "./resolvers/CollectionResolver";
import Media from "./Media";
import { isObjectLiteral, normalizeUri } from "./helpers/util";
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
    private collectionResolver: CollectionResolver;
    private resolvers: {
        matcher: UriMatcher,
        resolver: IResolver
    }[];

    constructor(
        collections: Collection[],
        private media: Media
    ) {
        // this.blankNodeIndex = 1;
        this.fsResolver = new FileSystemResolver();
        this.httpResolver = new HttpResolver();
        this.collectionResolver = new CollectionResolver(collections, this);
        this.resolvers = [
            {
                matcher: {protocol: FILE_PROTOCOL, path: collections.map(c => c.uri)},
                resolver: this.collectionResolver
            },
            {
                matcher: {protocol: FILE_PROTOCOL},
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

    get referencedJsonLds() {
        return this.fsResolver.referencedJsonLds;
    }

    async resolveUri(uriStr: string) {
        const uriObj: URI = parseUri(normalizeUri(uriStr)) as URI;
        // Fill in protocol and host for relative path
        if (!uriObj.protocol && !uriObj.host) {
            uriObj.protocol = FILE_PROTOCOL;
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

        // data is image if type is Buffer
        if (data instanceof Buffer) {
            // convert binary image data to schema ImageObject
            const mediaUri = uriObj.protocol === FILE_PROTOCOL ?
                uriObj.path :
                `${uriObj.protocol}//${uriObj.host}${uriObj.path}`;
            data = await this.media.toImageObject(mediaUri, data);
        } else if (isSchemaType(data, IMAGE_OBJECT, false)) {
            const image = await this.resolveUri(data.contentUrl);
            data = {
                ...data,
                ...await this.media.toImageObject(data.contentUrl, image)
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
        // this.ensureJsonLd(jsonld, uri);
        jsonld = await this.hydrate(jsonld);
        return jsonld;
    }

    /*
    // all data need @id and @type
    private async ensureJsonLd(jsonld: any, impliedId: string) {
        if (Array.isArray(jsonld)) {
            return;
        }
        if (!jsonld[JSONLD_ID]) {
            // jsonld[JSONLD_ID] = impliedId ? impliedId : `_:${this.blankNodeIndex++}`;
            jsonld[JSONLD_ID] = impliedId;
        }
    }*/

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
                const uri = target[JSONLD_ID];
                nextTarget = await this.resolveUri(uri);
                // this.ensureJsonLd(nextTarget, uri);
            }
            return await this.hydrate(
                nextTarget,
                nextLevel,
                graph
            );
        } else if (isObjectLiteral(target)) {
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