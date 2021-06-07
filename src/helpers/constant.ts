import { URLSearchParams } from "url";
/*
export const WebElement = {
    SiteNavigation: "SiteNavigation",
    AdBlock: "AdBlock",
    Footer: "Footer",
    Header: "Header",
    SideBar: "SideBar",
    // Table: "Table"
}

export const Action = {
    Search: "Search",
    Review: "Review",
    Like: "Like",
    Listen: "Listen",
    View: "View",
    Watch: "Watch",
    Subscribe: "Subscribe",
    Comment: "Comment",
    Reply: "Reply",
    Share: "Share",
}*/

// export const SORT_ASC = "asc";
// export const SORT_DESC = "desc";

/*
export type SortBy = {
    prop: string,
    order: "asc" | "desc"
}*/

export type Theme = {
    name: string,
    options: object
};

export type PartitionKey = {[key: string]: string | number | Date};
export type Collection = {
    uri: string,
    match: string | string[],
    groupBy?: (mainEntity: any) => PartitionKey | PartitionKey[],
    sort?: (a: any, b: any) => number
}


export type WebPage = {
    // "@id": string,
    "@type": string,
    url: string,
    mainEntity: any,
    [key: string]: any
}

export type OnBundleChanged = (isError: boolean, entry: any) => void;

export interface IHtmlSerializer {
    toHtml(renderResult: unknown): string;
}

export type URI = {
    protocol: string,
    host: string,
    path: string,
    query?: URLSearchParams
}

export interface IResolver {
    resolveUri(uri: URI): Promise<any>;
    clearCache(): void;
}

export const CACHE_FOLDER = ".sambal";
export const OUTPUT_FOLDER = "public";
export const PAGES_FOLDER = "pages";
export const DATA_FOLDER = "data";
export const SAMBAL_ENTRY_FILE = "sambal.entry.js";
export const SAMBAL_SITE_FILE = "sambal.site.js";

export const MOUNT_FILE = "_mount.yml";
export const PAGE_FILE = "_page.yml";
export const LOCALHOST = "localhost";
export const FS_PROTO = "fs";

// for DevServer
export const THEME_PUBLIC_PATH = "/_theme";
export const DEV_PUBLIC_PATH = "/_sambal";

