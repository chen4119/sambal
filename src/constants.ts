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

export type SortBy = {
    field: string,
    order: "desc" | "asc"
};

export type CollectionDef = {
    name: string,
    sortBy?: SortBy | SortBy[],
    groupBy?: string | string[]
};

export type SambalData = {
    base?: string,
    uri: string,
    data: any,
    html?: CheerioStatic,
    jsonld?: any[]
}