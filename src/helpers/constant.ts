
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

export const SORT_ASC = "asc";
export const SORT_DESC = "desc";

export type SortBy = {
    prop: string,
    order: "asc" | "desc"
}

export type Theme = {
    name: string,
    options: object
};

export type Collection = {
    "@id": string,
    "@type"?: string,
    src: string | string[],
    groupBy?: string[],
    sortBy?: SortBy
}

export type PageNode = {
    "@id": string,
    "@type": string,
    url: string,
    mainEntity: any,
    hasPart: any[],
    [key: string]: any
}

export type OnBundleChanged = (isError: boolean, entry: any) => void;

export interface IHtmlSerializer {
    toHtml(renderResult: unknown);
}

export const CACHE_FOLDER = ".sambal";
export const OUTPUT_FOLDER = "public";
export const SAMBAL_ENTRY_FILE = "sambal.entry.js";
export const SAMBAL_SITE_FILE = "sambal.site.js";
export const WEBSOCKET_ADDR = "ws://localhost:3001/";

// collection
export const NULL_VALUE = "__null__";
export const EMPTY_VALUE = "__empty__";
