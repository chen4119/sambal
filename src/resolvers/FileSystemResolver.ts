import {
    IResolver,
    URI,
    DATA_FOLDER,
    PAGES_FOLDER
} from "../helpers/constant";
import {
    normalizeJsonLdId,
    loadLocalFile,
    isImageFile
} from "../helpers/data";
import { log } from "../helpers/log";

export default class FileSystemResolver implements IResolver {
    private localFileMap: Map<string, string>; // map uri to file path
    private objectCache: Map<string, unknown>;

    constructor(pages: string[], data: string[]) {
        this.localFileMap = new Map<string, string>(); 
        this.objectCache = new Map<string, unknown>();
        this.indexFilePaths(PAGES_FOLDER, pages);
        this.indexFilePaths(DATA_FOLDER, data);
    }

    isLocalImageFile(uriStr: string) {
        return this.localFileMap.has(uriStr) && isImageFile(this.localFileMap.get(uriStr));
    }

    async resolveUri(uri: URI) {
        const uriStr = uri.path;
        if (this.objectCache.has(uriStr)) {
            return this.objectCache.get(uriStr);
        }

        if (this.localFileMap.has(uriStr)) {
            const filePath = this.localFileMap.get(uriStr);
            const jsonld = await loadLocalFile(filePath);
            this.objectCache.set(uriStr, jsonld);
            return jsonld;
        }
        throw new Error(`Unable to resolve ${uriStr}`);
    }

    clearCache() {
        this.objectCache.clear();
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