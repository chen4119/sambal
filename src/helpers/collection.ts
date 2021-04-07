import { JSONLD_ID } from "sambal-jsonld";
import {
    NULL_VALUE,
    EMPTY_VALUE
} from "./constant";
import {
    isJsDate
} from "./util";


// const MAX_INDEX_VALUE_CHAR = 600;

/*
export function mapJsonToPartitions(expandedJsonLd, groupBy) {
    const groupByValues = [];
    for (const groupByField of groupBy) {
        groupByValues.push(expandedJsonLd[groupByField]);
    }
    return getPartitionKeys(groupBy, groupByValues);
}

function getPartitionKeys(groupByKeys, groupByValues) {
    const partitionKeys = [];
    const indexes = groupByValues.map(value => Array.isArray(value) ? value.length : 0);
    let isDone = false;
    while (!isDone) {
        const partitionKey = [];
        for (let i = 0; i < groupByKeys.length; i++) {
            const value = groupByValues[i];
            if (Array.isArray(value)) {
                partitionKey.push(normalizeValue(value[--indexes[i]]));
            } else {
                partitionKey.push(normalizeValue(value));
            }
        }
        if (partitionKey.join("").length > MAX_INDEX_VALUE_CHAR) {
            throw new Error(`Partition key cannot excceed ${MAX_INDEX_VALUE_CHAR} chars`);
        }
        partitionKeys.push(partitionKey);
        isDone = indexes.filter(i => i > 0).length === 0; 
    }
    return partitionKeys;
}*/

function normalizeValue(value) {
    if (value === NULL_VALUE || value === EMPTY_VALUE) {
        throw new Error(`${value} is reserved`);
    } else if (typeof(value) === "undefined" || value === null) {
        return NULL_VALUE;
    } else if (typeof(value) === "string" && value.length === 0) {
        return EMPTY_VALUE;
    } else if (isJsDate(value)) {
        return value.getTime();
    } else if (typeof(value) === "object") {
        if (!value[JSONLD_ID]) {
            throw new Error("No complex index value allowed");
        }
        return value[JSONLD_ID];
    }
    return value;
}

export function getSortKey(jsonLd, propName: string) {
    return normalizeValue(jsonLd[propName]);
}

