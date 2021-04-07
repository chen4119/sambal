import {
    JSONLD_TYPE,
    JSONLD_CONTEXT,
    SCHEMA_CONTEXT
} from "sambal-jsonld";

/*
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
*/

