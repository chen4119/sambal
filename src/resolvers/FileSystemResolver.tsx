import {
    IResolver,
    URI,
    DATA_FOLDER,
    PAGES_FOLDER
} from "../helpers/constant";
import {
    normalizeJsonLdId,
    loadLocalFile,
    loadUri,
    isImageFile
} from "../helpers/data";
import { log } from "../helpers/log";
import Media from "../Media";
import CollectionBuilder from "../CollectionBuilder";
import { isSchemaType } from "sambal-jsonld";

const IMAGE_OBJECT = "imageobject";

export default class FileSystemResolver implements IResolver {
    private localFileMap: Map<string, string>; // map uri to file path
    private objectCache: Map<string, unknown>;

    constructor(
        pages: string[],
        data: string[],
        private media: Media,
        private collections: CollectionBuilder) {

        this.localFileMap = new Map<string, string>(); 
        this.objectCache = new Map<string, unknown>();
        this.indexFilePaths(PAGES_FOLDER, pages);
        this.indexFilePaths(DATA_FOLDER, data);   
    }

    async resolveUri(uri: URI) {
        const uriStr = uri.path;
        if (this.objectCache.has(uriStr)) {
            return this.objectCache.get(uriStr);
        }

        if (this.localFileMap.has(uriStr)) {
            const filePath = this.localFileMap.get(uriStr);
            let jsonld;
            if (isImageFile(filePath)) {
                const image = await loadLocalFile(filePath);
                jsonld = await this.media.loadImageUrl(uriStr, image);
            } else {
                jsonld = await loadLocalFile(filePath);
                if (isSchemaType(jsonld, IMAGE_OBJECT, false)) {
                    const image = await loadUri(jsonld.contentUrl);
                    jsonld = await this.media.loadImageUrl(uriStr, image);
                }
            }
            this.objectCache.set(uriStr, jsonld);
            return jsonld;
        }
        // TODO: load collection
        throw new Error(`Unable to resolve ${uriStr}`);
    }

    private indexFilePaths(baseFolder: string, paths: string[]) {
        for (const filePath of paths) {
            const uri = normalizeJsonLdId(filePath);
            const accessPath = `${baseFolder}/${filePath}`;
            if (this.localFileMap.has(uri)) {
                log.error(`${uri} is found in both pages and data folder`);
            }
            this.localFileMap.set(uri, accessPath);
        }
    }


}