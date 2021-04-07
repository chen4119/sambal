import { expandJsonLd, JSONLD_ID, JSONLD_TYPE } from "sambal-jsonld";
import Graph from "./Graph";
import {
    Collection,
    SortBy,
    PartitionKey,
    SORT_ASC
} from "./helpers/constant";
import {
    isJsDate,
    isNullOrUndefined
} from "./helpers/util";
import {
    getSortKey
} from "./helpers/collection";
import { searchLocalFiles, normalizeJsonLdId } from "./helpers/data";
import { isObjectLiteral } from "sambal-jsonld/dist/utils";

type IndexItem = {
    [JSONLD_ID]: string,
    sortValue?: string | number | Date
};

type IndexList = IndexItem[];

type Partition = {
    groupBy?: PartitionKey,
    feed: IndexList
};

const RESERVED_PARTITION_KEY_NAMES = ["pageNum"];

export default class CollectionBuilder {
    private collectionMap: Map<String, Partition[]>;
    constructor(private siteGraph: Graph, private collections: Collection[]) {
        if (collections) {
            collections.forEach(c => {
                c[JSONLD_ID] = normalizeJsonLdId(c[JSONLD_ID]);
            });
        }
        this.collectionMap = new Map<String, Partition[]>();
    }

    async getCollectionPages(collectionIRI: string, pageSize: number) {
        const normalizeIRI = normalizeJsonLdId(collectionIRI);
        const collection = this.getCollection(normalizeIRI);
        let partitions: Partition[] = this.collectionMap.get(normalizeIRI);
        if (!partitions) {
            partitions = await this.build(collection);
        }
        let pages = [];
        for (const partition of partitions) {
            pages.push({
                key: partition.groupBy ? partition.groupBy : null,
                pages: await this.paginatePartition(collection, partition, pageSize)
            });
        }
        return pages;
    }

    async getPartitionPages(collectionIRI: string, partitionKey: PartitionKey, pageSize: number) {
        const normalizeIRI = normalizeJsonLdId(collectionIRI);
        const collection = this.getCollection(normalizeIRI);
        let partitions: Partition[] = this.collectionMap.get(normalizeIRI);
        if (!partitions) {
            partitions = await this.build(collection);
        }
        const keyStrToMatch = this.stringifyKey(partitionKey);
        let pages = [];
        for (const partition of partitions) {
            if (partition.groupBy && this.stringifyKey(partition.groupBy) === keyStrToMatch) {
                pages.push({
                    key: partition.groupBy ? partition.groupBy : null,
                    pages: await this.paginatePartition(collection, partition, pageSize)
                });
            }
        }
        return pages;
    }

    private async paginatePartition(collection: Collection, partition: Partition, pageSize: number) {
        const pages = [];
        if (pageSize > partition.feed.length) {
            const pageIRI = this.getCollectionPageUrl(collection[JSONLD_ID], partition.groupBy);
            pages.push(this.serializeItemList(collection, pageIRI, partition.feed));
        } else {
            let currentIndex = 0;
            let prevItem = null;
            while(currentIndex < partition.feed.length) {
                const start = currentIndex;
                const end = Math.min(start + pageSize, partition.feed.length);
                const position = pages.length;
                const slice = partition.feed.slice(start, end);
                const item = this.serializeListItem(collection, partition, slice, prevItem, position);
                prevItem = item;
                pages.push(item);
                currentIndex = end;
            }
        }
        for (const page of pages) {
            await this.siteGraph.load(page);
        }
        return pages;
    }

    private serializeListItem(collection: Collection, partition: Partition, slice: IndexItem[], prevItem: any, position: number) {
        const pageIRI = this.getCollectionPageUrl(collection[JSONLD_ID], partition.groupBy, position);
        const item: any = {
            [JSONLD_ID]: pageIRI,
            [JSONLD_TYPE]: "ListItem",
            item: this.serializeItemList(collection, `${pageIRI}/items`, slice),
            position: position
        };
        if (prevItem) {
            item.previousItem = {
                [JSONLD_ID]: prevItem[JSONLD_ID]
            };
            prevItem.nextItem = {
                [JSONLD_ID]: item[JSONLD_ID]
            };
        }
        return item;
    }

    private serializeItemList(collection: Collection, listIRI: string, list: IndexItem[]) {
        const listType = collection[JSONLD_TYPE] ? collection[JSONLD_TYPE] : "ItemList";
        return {
            [JSONLD_ID]: listIRI,
            [JSONLD_TYPE]: listType,
            itemListElement: list.map(d => ({
                [JSONLD_ID]: d[JSONLD_ID]
            }))
        }
    }

    private getCollectionPageUrl(collectionIRI: string, partitionKey?: PartitionKey, pageIndex?: number) {
        const paths = [collectionIRI];
        const params: any = partitionKey ? partitionKey : {};
        if (pageIndex) {
            params.pageNum = pageIndex + 1;
        }
        let queries = [];
        for (const name of Object.keys(params)) {
            queries.push(`${encodeURIComponent(name)}=${encodeURIComponent(params[name])}`);
        }
        if (queries.length > 0) {
            return `${collectionIRI}?${queries.join("&")}`;
        }
        return collectionIRI;
    }

    private async build(collection: Collection) {
        const matches = searchLocalFiles(collection.src);
        let partitions: Partition[];
        if (collection.groupBy) {
            partitions = await this.addToPartitionedList(collection, matches);
        } else {
            partitions = await this.addToSingleList(collection, matches);
        }

        if (collection.sortBy) {
            this.sortFeeds(partitions, collection.sortBy);
        }
        this.collectionMap.set(collection[JSONLD_ID], partitions);
        return partitions;
    }

    private async addToSingleList(collection: Collection, filePaths: string[]) {
        const feed: IndexList = [];
        for (const filePath of filePaths) {
            const jsonld = expandJsonLd(await this.siteGraph.load(filePath));
            feed.push(this.getFeedItem(jsonld, collection.sortBy));
        }
        return [{
            feed: feed
        }];
    }

    private async addToPartitionedList(collection: Collection, filePaths: string[]) {
        const partitionMap = new Map<string, Partition>();
        for (const filePath of filePaths) {
            const mainEntity = await this.siteGraph.load(filePath);
            const partitions = collection.groupBy(mainEntity);
            if (Array.isArray(partitions)) {
                for (const partitionKey of partitions) {
                    const partition = this.getPartition(partitionMap, partitionKey);
                    partition.feed.push(this.getFeedItem(mainEntity, collection.sortBy));
                }
            } else if (isObjectLiteral(partitions)) {
                const partition = this.getPartition(partitionMap, partitions);
                partition.feed.push(this.getFeedItem(mainEntity, collection.sortBy));
            } else {
                throw new Error(`Invalid partition key: ${partitions}`);
            }
        }
        return Array.from(partitionMap.values());
    }

    private getPartition(partitionMap: Map<string, Partition>, key: PartitionKey) {
        const keyStr = this.stringifyKey(key);
        let partition: Partition;
        if (partitionMap.has(keyStr)) {
            partition = partitionMap.get(keyStr);
        } else {
            partition = {
                groupBy: key,
                feed: []
            };
            partitionMap.set(keyStr, partition);
        }
        return partition;
    }

    private getFeedItem(jsonld: any, sortBy?: SortBy) {
        const item: IndexItem = { [JSONLD_ID]: jsonld[JSONLD_ID] };
        if (sortBy) {
            item.sortValue = getSortKey(jsonld, sortBy.prop);
        }
        return item;
    }
 
    private sortFeeds(partitions: Partition[], sortBy: SortBy) {
        for (const partition of partitions) {
            partition.feed.sort((a, b) => this.compare(a.sortValue, b.sortValue, sortBy.order));
        }
    }

    private compare(aValue: any, bValue: any, order: string) {
        if (isNullOrUndefined(aValue) && isNullOrUndefined(bValue)) {
            return 0;
        } else if (isNullOrUndefined(aValue)) {
            return 1;
        } else if (isNullOrUndefined(bValue)) {
            return -1;
        }
        return this.compareNonNullValues(aValue, bValue, order);
    }

    private compareNonNullValues(aValue: any, bValue: any, order: string) {
        if (isJsDate(aValue) && isJsDate(bValue)) {
            return order === SORT_ASC ? (aValue.getTime() - bValue.getTime()) : (bValue.getTime() - aValue.getTime());
        } else if (typeof(aValue) === "number" && typeof(bValue) === "number") {
            return order === SORT_ASC ? (aValue - bValue) : (bValue - aValue);
        }
        return order === SORT_ASC ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
    }

    private getCollection(collectionIRI: string) {
        const collection = this.collections ? this.collections.find(d => d[JSONLD_ID] === collectionIRI) : null;
        if (!collection) {
            throw new Error(`collection ${collectionIRI} not found`);
        }
        return collection;
    }

    private stringifyKey(partitionKey: PartitionKey) {
        const fieldNames = Object.keys(partitionKey);
        fieldNames.sort();
        let keyStr = "";
        for (const name of fieldNames) {
            if (RESERVED_PARTITION_KEY_NAMES.indexOf(name.toLowerCase()) >= 0) {
                throw new Error(`${name} is a reserved partition key name`);
            }
            if (typeof(partitionKey[name]) !== "string" && 
                typeof(partitionKey[name]) !== "number" &&
                !isJsDate(partitionKey[name])) {
                throw new Error(`Invalid partition key: ${JSON.stringify(partitionKey)} - Only string, number or date value allowed`);
            }
            keyStr += `${name}=${partitionKey[name]};`;
        }
        return keyStr;
    }

}