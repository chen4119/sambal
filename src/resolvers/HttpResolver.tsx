import { IResolver, URI } from "../helpers/constant";
import Media from "../Media";
import {
    isImageFile,
    loadRemoteFile,
    loadUri
} from "../helpers/data";
import { isSchemaType } from "sambal-jsonld";

const IMAGE_OBJECT = "imageobject";

export default class HttpResolver implements IResolver {
    private objectCache: Map<string, unknown>;
    constructor(private media: Media) {
        this.objectCache = new Map<string, unknown>();
    }

    async resolveUri(uri: URI) {
        const absUrl = `${uri.protocol}//${uri.host}/${uri.path}`;

        if (this.objectCache.has(absUrl)) {
            return this.objectCache.get(absUrl);
        }
        let jsonld
        if (isImageFile(absUrl)) {
            const image = await loadRemoteFile(absUrl);
            jsonld = await this.media.loadImageUrl(absUrl, image);
        } else {
            jsonld = await loadRemoteFile(absUrl);
            if (isSchemaType(jsonld, IMAGE_OBJECT, false)) {
                const image = await loadUri(jsonld.contentUrl);
                jsonld = await this.media.loadImageUrl(absUrl, image);
            }
        }
        this.objectCache.set(absUrl, jsonld);
        return jsonld;
    }


}