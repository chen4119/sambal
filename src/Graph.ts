import {
    JSONLD_CONTEXT,
    JSONLD_GRAPH,
    JSONLD_ID,
    JSONLD_TYPE,
    SCHEMA_CONTEXT,
    // toJsonLdGraph,
    isJsonLdRef
} from "sambal-jsonld";
import { isObjectLiteral, writeText } from "./helpers/util";
import {
    normalizeJsonLdId
} from "./helpers/data"; 
import UriResolver from "./UriResolver";

const MAX_DEPTH = 100;

export default class Graph {
    private blankNodeIndex: number;

    constructor(private uriResolver: UriResolver) {
        this.blankNodeIndex = 1;
    }

    /*
    async serialize(baseUrl: string) {
        const graph = [];
        for (const iri of Array.from(this.objectCache.keys())) {
            if (!isExternalSource(iri) && !iri.startsWith("_:")) {
                graph.push(this.objectCache.get(iri));
            }
        }
        // const flatten = toJsonLdGraph(graph, SCHEMA_CONTEXT);
        for (const jsonld of graph) {
            await writeText(`./${OUTPUT_FOLDER}/content/${jsonld[JSONLD_ID]}.json`, JSON.stringify({
                [JSONLD_CONTEXT]: {
                    "@vocab": SCHEMA_CONTEXT,
                    "@base": baseUrl
                },
                ...jsonld as object
            }, null, 4));
        }
    }*/

    /*
    getIncomingLinks(iri: string) {
        return this.links.getIncomingLinks(iri);
    }

    getOutgoingLinks(iri: string) {
        return this.links.getOutgoingLinks(iri);
    }*/

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
        const uri = normalizeJsonLdId(src);
        const jsonld = await this.uriResolver.resolveUri(uri);
        await this.ensureJsonLd(jsonld, uri);
        return jsonld;
    }

    // all data need @id and @type
    private async ensureJsonLd(jsonld: any, impliedId?: string) {
        if (Array.isArray(jsonld)) {
            return;
        }
        if (!jsonld[JSONLD_ID]) {
            jsonld[JSONLD_ID] = impliedId ? impliedId : `_:${this.blankNodeIndex++}`;
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
        } else if (isJsonLdRef(target)) {
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
            // this.links.add(subjectIRI, predicateIRI, target[JSONLD_ID]);
            await this.iterateObjectKeys(target, nextLevel, graph);
        }
        return target;
    }

    private async iterateObjectKeys(
        target: unknown,
        level: number,
        graph?: Map<string, unknown>
    ) {
        /*
        if (target[JSONLD_TYPE].toLowerCase() === IMAGE_OBJECT) {
            await this.media.loadImageObject(target);
        }*/
        let objectGraph = null;
        for (const fieldName of Object.keys(target)) {
            if (fieldName !== JSONLD_ID && fieldName !== JSONLD_TYPE && fieldName !== JSONLD_CONTEXT) {
                const fieldValue = target[fieldName];
                if (fieldName === JSONLD_GRAPH) {
                    objectGraph = this.getGraphContext(fieldValue);
                }
                target[fieldName] = await this.hydrate(
                    target[JSONLD_ID],
                    fieldName,
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