import {
    IResolver,
    URI
} from "../helpers/constant";
import { loadLocalFile } from "../helpers/data";
import { deepClone, isValidRelativePath } from "../helpers/util";

export default class FileSystemResolver implements IResolver {
    private objectCache: Map<string, unknown>;

    constructor() {
        this.objectCache = new Map<string, unknown>();
    }


    async resolveUri(uri: URI) {
        // const uriStr = uri.path;
        if (this.objectCache.has(uri.path)) {
            return deepClone(this.objectCache.get(uri.path));
        }

        if (isValidRelativePath(uri.path)) {
            const jsonld = await loadLocalFile(uri.path);
            this.objectCache.set(uri.path, jsonld);
            // return clone otherwise obj will be modified when hydrated
            return deepClone(jsonld);
        }
        throw new Error(`Unable to resolve ${uri.path}`);
    }

    clearCache() {
        this.objectCache.clear();
    }

    get referencedJsonLds() {
        return Array.from(this.objectCache.keys());
    }
}