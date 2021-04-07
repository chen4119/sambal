import {
    JSONLD_CONTEXT,
    JSONLD_GRAPH,
    JSONLD_ID,
    JSONLD_TYPE,
    SCHEMA_CONTEXT
} from "sambal-jsonld";
import { isObjectLiteral, writeText } from "./helpers/util";
import { OUTPUT_FOLDER, WebPage } from "./helpers/constant";
import Media from "./Media";
import Links from "./Links";
import { 
    isExternalSource,
    isImageFile,
    loadRemoteFile,
    loadLocalFile,
    getLocalFilePath,
    isSupportedFile,
    normalizeJsonLdId
} from "./helpers/data"; 


const IMAGE_OBJECT = "imageobject";
const MAX_DEPTH = 100;

export default class Graph {
    private objectCache: Map<string, unknown>;
    private blankNodeIndex: number;

    constructor(private baseUrl: string, private media: Media, private links: Links) {
        this.objectCache = new Map<string, unknown>();
        this.blankNodeIndex = 1;
    }

    async serialize() {
        for (const iri of Array.from(this.objectCache.keys())) {
            if (!isExternalSource(iri) && !iri.startsWith("_:")) {
                await writeText(`./${OUTPUT_FOLDER}/content/${iri}.json`, JSON.stringify({
                    [JSONLD_CONTEXT]: {
                        "@vocab": SCHEMA_CONTEXT,
                        "@base": this.baseUrl
                    },
                    ...this.objectCache.get(iri) as object
                }, null, 4));
            }
        }
    }

    getIncomingLinks(iri: string) {
        return this.links.getIncomingLinks(iri);
    }

    getOutgoingLinks(iri: string) {
        return this.links.getOutgoingLinks(iri);
    }

    async load(src: any) {
        let jsonld = src;
        if (typeof(src) === "string") {
            jsonld = await this.loadJsonLdPath(src);
        }
        await this.ensureJsonLd(jsonld);
        jsonld = await this.hydrate(null, null, jsonld, 1);
        return jsonld;
    }

    private async loadJsonLdPath(src: string) {
        const idFromSrc = normalizeJsonLdId(src);
        if (this.objectCache.has(idFromSrc)) {
            return this.objectCache.get(idFromSrc);
        }

        let jsonld;
        if (isImageFile(src)) {
            // src can be remote or local
            jsonld = await this.media.loadImagePath(src);
        } else if (isExternalSource(src)) {
            jsonld = await loadRemoteFile(src);
        } else {
            let filePath = src;
            // Most likely no file extension specified
            if (!isSupportedFile(filePath)) {
                filePath = getLocalFilePath(src);
            }
            if (isImageFile(filePath)) {
                jsonld = await this.media.loadImagePath(filePath);
            } else {
                jsonld = await loadLocalFile(filePath);
            }
        }
        await this.ensureJsonLd(jsonld, idFromSrc);
        return jsonld;
    }
    
    // all data need @id and @type
    // make sure image obj are populated correctly
    private async ensureJsonLd(jsonld: any, impliedId?: string) {
        if (!jsonld[JSONLD_ID]) {
            jsonld[JSONLD_ID] = impliedId ? impliedId : `_:${this.blankNodeIndex++}`;
        }
        if (!jsonld[JSONLD_TYPE]) {
            jsonld[JSONLD_TYPE] = "Thing"; // root type
        }
        if (jsonld[JSONLD_TYPE].toLowerCase() === IMAGE_OBJECT) {
            await this.media.loadImageObject(jsonld);
        }
    }

    private async hydrate(
        subjectIRI: string,
        predicateIRI: string,
        target: unknown,
        level: number,
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
                    await this.hydrate(subjectIRI, predicateIRI, item, nextLevel, graph)
                );
            }
            return resolvedArr;
        } else if (this.isJsonLdRef(target)) {
            // this.links.add(subjectIRI, predicateIRI, target[JSONLD_ID]);
            let nextTarget;
            if (graph && graph.has(target[JSONLD_ID])) {
                nextTarget = graph.get(target[JSONLD_ID]);
            } else {
                nextTarget = await this.loadJsonLdPath(target[JSONLD_ID])
            }
            return await this.hydrate(
                subjectIRI,
                predicateIRI,
                nextTarget,
                level,
                graph
            );
        } else if (isObjectLiteral(target)) {
            await this.ensureJsonLd(target);
            this.links.add(subjectIRI, predicateIRI, target[JSONLD_ID]);

            if (!this.objectCache.has(target[JSONLD_ID])) {
                this.objectCache.set(target[JSONLD_ID], target);
                await this.iterateObjectKeys(target, nextLevel, graph);
            }
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
                    target[JSONLD_ID],
                    `schema:${fieldName}`, // TODO: may not always be schema
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

    private isJsonLdRef(value) {
        return isObjectLiteral(value) && Object.keys(value).length === 1 && typeof (value[JSONLD_ID]) === "string";
    }
}