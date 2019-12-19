export enum SUPPORTED_CONTENT_TYPE {
    yaml,
    markdown,
    json,
    html
}

export const SUPPORTED_FILE_EXT_REGEX = /.+(.yaml|.yml|.json|.md)$/i;
export const CACHE_FOLDER = "./.sambal";
export const OUTPUT_FOLDER = "./public";
export const DESC = "desc";
export const ASC = "asc";