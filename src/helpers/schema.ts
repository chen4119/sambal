import {
    JSONLD_TYPE,
    JSONLD_CONTEXT,
    SCHEMA_CONTEXT
} from "sambal-jsonld";

const PREFIX_MAP = new Map();
PREFIX_MAP.set("schema", SCHEMA_CONTEXT);

export function toAbsWellKnownIRI(compactIRI: string) {
    const splitted = compactIRI.split(":");
    if (splitted.length === 1) {
        return compactIRI;
    }
    if (PREFIX_MAP.has(splitted[0])) {
        return `${PREFIX_MAP.get(splitted[0])}/${splitted[1]}`;
    }
    throw new Error(`Unrecognized prefix: ${splitted[0]}`);
}

export function toCompactWellKnownIRI(absoluteIRI: string) {
    if (absoluteIRI.startsWith(SCHEMA_CONTEXT)) {
        return `schema:${absoluteIRI.substring(SCHEMA_CONTEXT.length + 1)}`;
    }
    return absoluteIRI;
}

// TODO: Assuming everything is schema.org.  Support generic jsonld?
export function deriveEntityType(entity: unknown) {
    return `schema:${entity[JSONLD_TYPE]}`.toLowerCase();
}

/*
export function toSchemaPage(route: Route) {
    const pageJson: any = {
        ...route.pageProps,
        url: route.url,
        [JSONLD_CONTEXT]: SCHEMA_CONTEXT,
        [JSONLD_TYPE]: getSchemaWebPageType(route.pageType)
    };
    return pageJson;
}

function getSchemaWebPageType(pageType) {
    switch (pageType) {
        case Page.About:
        case Page.Collection:
        case Page.Contact:
        case Page.FAQ:
        case Page.Item:
        case Page.Profile:
        case Page.SearchResults:
            return pageType;
        default:
            return "schema:webpage";
    }
}*/

