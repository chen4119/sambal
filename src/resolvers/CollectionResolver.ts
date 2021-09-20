import { JSONLD_TYPE } from "sambal-jsonld";
import {
    IResolver,
    Collection,
    PartitionKey,
    URI,
    PAGE_FILE
} from "../helpers/constant";
import { isObjectLiteral, normalizeUri } from "../helpers/util";
import { searchFiles, inferUrl } from "../helpers/data";
import UriResolver from "../UriResolver";

type CollectionItem = {
    uri: string,
    item: any
}

type Partition = {
    groupBy?: PartitionKey,
    feed: CollectionItem[]
};

const DEFAULT_PAGE_SIZE = 100;

export default class CollectionResolver implements IResolver {
    private collectionMap: Map<String, Partition[]>;

    constructor(
        private collections: Collection[],
        private uriResolver: UriResolver) {
        this.collectionMap = new Map<String, Partition[]>();
    }

    clearCache() {
        this.collectionMap.clear();
    }

    /*
        If partitioned collection, need to provide partition key
    */
    async resolveUri(uri: URI) {
        const collection: Collection = this.getCollection(uri.path);
        const query = this.parseSearchParams(uri);

        const partitions = await this.build(collection);
        let resolvedPartition = partitions[0];

        if (collection.groupBy && Object.keys(query.partitionKey).length === 0) {
            throw new Error(`No partition key specified for collection ${uri.path}`);
        }
        
        if (collection.groupBy) {
            resolvedPartition = this.queryPartition(partitions, query);
        }

        if (!resolvedPartition) {
            throw new Error(`No partition found for ${uri.path}?${uri.query.toString()}`);
        }

        return this.serialize(resolvedPartition, query);
    }

    private queryPartition(partitions, query) {
        const keyStrToMatch = this.stringifyKey(query.partitionKey);
        for (const partition of partitions) {
            if (this.stringifyKey(partition.groupBy) === keyStrToMatch) {
                return partition;
            }
        }
        return null;
    }

    async getPartitions(uri: URI) {
        const collection: Collection = this.getCollection(uri.path);
        if (collection.groupBy) {
            const partitions = await this.build(collection);
            return partitions.map(p => p.groupBy);
        }
        return [];
    }

    private parseSearchParams(uri: URI) {
        let partitionKey = {};
        let nav = false;
        let page = -1;
        let pagesize = DEFAULT_PAGE_SIZE;
        if (uri.query) {
            for (const name of Array.from(uri.query.keys())) {
                if (name === "output" && uri.query.get(name) === "sitenav") {
                    nav = true;
                } else if (name === "page" && !isNaN(+uri.query.get(name))) {
                    page = +uri.query.get(name);
                } else if (name === "pagesize" && !isNaN(+uri.query.get(name))) {
                    pagesize = +uri.query.get(name);
                } else {
                    partitionKey[name] = uri.query.get(name);
                }
            }
        }
        return {
            partitionKey,
            nav,
            page,
            pagesize
        };
    }
    
    private serialize(partition: Partition, query) {
        if (query.nav) {
            return partition.feed
            .map(feedItem => ({
                [JSONLD_TYPE]: "SiteNavigationElement",
                name: feedItem.item.name ? feedItem.item.name : feedItem.item.headline,
                url: inferUrl(feedItem.uri)
            }));
        }
        if (query.page > 0) {
            const endIndex = Math.min(partition.feed.length, query.page * query.pagesize);
            const startIndex = Math.max(0, endIndex - query.pagesize);
            const slice = partition.feed.slice(startIndex, endIndex);
            return this.serializeItemList(
                slice
            );
        }
        return this.serializeItemList(
            partition.feed
        );
    }

    private serializeItemList(feed: CollectionItem[]) {
        return {
            [JSONLD_TYPE]: "ItemList",
            itemListElement: feed.map(d => d.item)
        };
    }

    private async build(collection: Collection) {
        if (this.collectionMap.has(collection.uri)) {
            return this.collectionMap.get(collection.uri);
        }

        const matches = searchFiles(collection.include)
                            .filter(uri => !uri.endsWith(PAGE_FILE))
                            .map(uri => normalizeUri(uri));
        let partitions: Partition[];
        if (collection.groupBy) {
            partitions = await this.addToPartitionedList(collection, matches);
        } else {
            partitions = await this.addToSingleList(matches);
        }

        if (collection.sort) {
            this.sortFeeds(partitions, collection.sort);
        }
        this.collectionMap.set(collection.uri, partitions);
        return partitions;
    }

    private async addToSingleList(uris: string[]) {
        const feed: CollectionItem[] = [];
        for (const uri of uris) {
            const item = await this.uriResolver.hydrateUri(uri);
            feed.push({
                uri,
                item
            });
        }
        return [{
            feed: feed
        }];
    }

    private async addToPartitionedList(collection: Collection, uris: string[]) {
        const partitionMap = new Map<string, Partition>();
        for (const uri of uris) {
            const item = await this.uriResolver.hydrateUri(uri);
            const partitions = collection.groupBy(item);
            if (Array.isArray(partitions)) {
                for (const partitionKey of partitions) {
                    const partition = this.getPartition(partitionMap, partitionKey);
                    partition.feed.push({
                        uri,
                        item
                    });
                }
            } else if (isObjectLiteral(partitions)) {
                const partition = this.getPartition(partitionMap, partitions);
                partition.feed.push({
                    uri,
                    item
                });
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
 
    private sortFeeds(partitions: Partition[], sort: (a, b) => number) {
        for (const partition of partitions) {
            partition.feed.sort((itemA, itemB) => sort(itemA.item, itemB.item));
        }
    }

    private getCollection(collectionUri: string) {
        const collection = this.collections.find(c => c.uri === collectionUri);
        if (!collection) {
            throw new Error(`collection ${collectionUri} not found`);
        }
        return collection;
    }

    private stringifyKey(partitionKey: PartitionKey) {
        const fieldNames = Object.keys(partitionKey);
        fieldNames.sort();
        let keyStr = "";
        for (const name of fieldNames) {
            if (typeof(partitionKey[name]) !== "string" && 
                typeof(partitionKey[name]) !== "number") {
                throw new Error(`Invalid partition key: ${JSON.stringify(partitionKey)} - Only string or number value allowed`);
            }
            keyStr += `${name}=${partitionKey[name]};`;
        }
        return keyStr;
    }
}