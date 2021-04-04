import { expandJsonLd, JSONLD_ID, JSONLD_TYPE } from "sambal-jsonld";
import Graph from "./Graph";
import {
    Collection,
    SortBy,
    SORT_ASC
} from "./helpers/constant";
import {
    isJsDate,
    isNullOrUndefined
} from "./helpers/util";
import {
    mapJsonToPartitions,
    getSortKey
} from "./helpers/collection";
import { toAbsWellKnownIRI } from "./helpers/schema";
import { searchLocalFiles, normalizeRelativePath } from "./helpers/data";

type IndexItem = {
    [JSONLD_ID]: string,
    sortValue?: string | number | Date
};

type IndexList = IndexItem[];

type Partition = {
    groupBy?: string[],
    feed: IndexList
};

const PARTITION_PATH = "_part_";

export default class CollectionBuilder {
    private collectionMap: Map<String, Partition[]> = new Map<String, Partition[]>();
    constructor(private siteGraph: Graph, private collections: Collection[]) {

    }

    async getCollectionPages(collectionIRI: string, pageSize: number) {
        const normalizeIRI = normalizeRelativePath(collectionIRI);
        const collection = this.getCollection(normalizeIRI);
        let partitions: Partition[] = this.collectionMap.get(normalizeIRI);
        if (!partitions) {
            partitions = await this.build(collection);
        }
        let pages = [];
        for (const partition of partitions) {
            pages.push({
                key: partition.groupBy ? this.toPartitionKeyObject(normalizeIRI, partition.groupBy) : null,
                pages: await this.paginatePartition(collection, partition, pageSize)
            });
        }
        return pages;
    }

    async getPartitionPages(collectionIRI: string, partitionKey: any, pageSize: number) {
        const normalizeIRI = normalizeRelativePath(collectionIRI);
        const collection = this.getCollection(normalizeIRI);
        let partitions: Partition[] = this.collectionMap.get(normalizeIRI);
        if (!partitions) {
            partitions = await this.build(collection);
        }
    }

    private toPartitionKeyObject(collectionIRI: string, partitionKey: string[]) {
        const collection = this.getCollection(collectionIRI);
        const partitionObj: any = {};
        for (let i = 0; i < collection.groupBy.length; i++) {
            partitionObj[toAbsWellKnownIRI(collection.groupBy[i])] = partitionKey[i];
        }
        return partitionObj;
    }

    private toPartitionKeyStringArray(collectionIRI: string, partitionKey: object) {
        const collection = this.getCollection(collectionIRI);
        const partitionArr: any = {};
        for (let i = 0; i < collection.groupBy.length; i++) {
            // TODO: what if value is null or empty?
            const value = partitionKey[toAbsWellKnownIRI(collection.groupBy[i])];
            partitionArr.push(value);
        }
        return partitionArr;
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

    private getCollectionPageUrl(collectionIRI: string, partitionKey?: string[], pageIndex?: number) {
        const paths = [collectionIRI];
        if (partitionKey) {
            paths.push(PARTITION_PATH);
            for (const key of partitionKey) {
                paths.push(encodeURIComponent(key));
            }
        }
        if (pageIndex) {
            paths.push(String(pageIndex + 1));
        }
        return paths.join("/");
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
            const jsonld = expandJsonLd(await this.siteGraph.load(filePath));
            // TODO: Support other vocab for groupBy
            const partitions = mapJsonToPartitions(jsonld, collection.groupBy.map(d => toAbsWellKnownIRI(d)));
            for (const partitionKey of partitions) {
                const key = this.stringifyKey(partitionKey);
                let partition: Partition;
                if (partitionMap.has(key)) {
                    partition = partitionMap.get(key);
                } else {
                    partition = {
                        groupBy: partitionKey,
                        feed: []
                    };
                    partitionMap.set(key, partition);
                }
                partition.feed.push(this.getFeedItem(jsonld, collection.sortBy));
            }
        }
        return Array.from(partitionMap.values());
    }

    private getFeedItem(jsonld: any, sortBy?: SortBy) {
        const item: IndexItem = { [JSONLD_ID]: jsonld[JSONLD_ID] };
        if (sortBy) {
            item.sortValue = getSortKey(jsonld, toAbsWellKnownIRI(sortBy.prop));
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
        const collection = this.collections.find(d => d[JSONLD_ID] === collectionIRI);
        if (!collection) {
            throw new Error(`collection ${collectionIRI} not found`);
        }
        return collection;
    }

    private stringifyKey(groupByValues: string[] | number[]) {
        return groupByValues.join("-");
    }

}