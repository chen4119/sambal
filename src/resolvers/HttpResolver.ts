import { IResolver, URI } from "../helpers/constant";
import {
    loadRemoteFile
} from "../helpers/data";
import { deepClone } from "../helpers/util";

export default class HttpResolver implements IResolver {
    private objectCache: Map<string, unknown>;
    constructor() {
        this.objectCache = new Map<string, unknown>();
    }

    async resolveUri(uri: URI) {
        const absUrl = `${uri.protocol}//${uri.host}/${uri.path}`;

        if (this.objectCache.has(absUrl)) {
            return deepClone(this.objectCache.get(absUrl));
        }
        const jsonld = await loadRemoteFile(absUrl);
        // cache an original clone otherwise obj will be modified when hydrated
        this.objectCache.set(absUrl, jsonld);
        return deepClone(jsonld);
    }

    clearCache() {
        // do nothing
    }


}