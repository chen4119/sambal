import { IResolver, URI } from "../helpers/constant";
import {
    loadRemoteFile
} from "../helpers/data";

export default class HttpResolver implements IResolver {
    private objectCache: Map<string, unknown>;
    constructor() {
        this.objectCache = new Map<string, unknown>();
    }

    async resolveUri(uri: URI) {
        const absUrl = `${uri.protocol}//${uri.host}/${uri.path}`;

        if (this.objectCache.has(absUrl)) {
            return this.objectCache.get(absUrl);
        }
        const jsonld = await loadRemoteFile(absUrl);
        this.objectCache.set(absUrl, jsonld);
        return jsonld;
    }


}