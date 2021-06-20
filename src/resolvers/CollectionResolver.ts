import { JSONLD_ID, JSONLD_TYPE } from "sambal-jsonld";
import {
    IResolver,
    Collection,
    PartitionKey,
    URI,
    EntityUri,
    EntityType
} from "../helpers/constant";
import {
    isJsDate,
    isObjectLiteral
} from "../helpers/util";
import Router from "../Router";
import UriResolver from "../UriResolver";

type Partition = {
    groupBy?: PartitionKey,
    feed: any[]
};

const PARTITION_PATH = "_part";
const PAGE_PATH = "_page";

export default class CollectionResolver implements IResolver {
    private collectionMap: Map<String, Partition[]>;

    constructor(
        private collections: Collection[],
        private collectionRoutes: Map<string, EntityUri[]>,
        private uriResolver: UriResolver,
        private router: Router) {
        this.collectionMap = new Map<String, Partition[]>();
    }

    clearCache() {
        this.collectionMap.clear();
    }

    async resolveUri(uri: URI) {
        const collection: Collection = this.getCollection(uri.path);
        const query = this.parseSearchParams(uri);

        const partitions = await this.build(collection);
        if (Object.keys(query.partitionKey).length > 0) {
            const keyStrToMatch = this.stringifyKey(query.partitionKey);
            for (const partition of partitions) {
                if (this.stringifyKey(partition.groupBy) === keyStrToMatch) {
                    const listUri = this.getCollectionPageUri(collection.uri, partition.groupBy);
                    return this.serialize(listUri, partition.feed, query.nav);
                }
            }
            throw new Error(`No partition found for ${uri.path}?${uri.query.toString()}`);
        }
        let pages = [];
        for (const partition of partitions) {
            const listUri = this.getCollectionPageUri(collection.uri, partition.groupBy);
            const result = this.serialize(listUri, partition.feed, query.nav);
            pages.push(result);
        }
        return pages.length === 1 ? pages[0] : pages;
    }

    private parseSearchParams(uri: URI) {
        let partitionKey = {};
        let nav = false;
        if (uri.query) {
            for (const name of Array.from(uri.query.keys())) {
                if (name === "output" && uri.query.get(name) === "sitenav") {
                    nav = true;
                } else {
                    partitionKey[name] = uri.query.get(name);
                }
            }
        }
        return {
            partitionKey,
            nav
        };
    }

    async getCollectionPages(uri: URI, pageSize: number) {
        const collection: Collection = this.getCollection(uri.path);
        const query = this.parseSearchParams(uri);

        const partitions = await this.build(collection);

        let pages = [];
        if (Object.keys(query.partitionKey).length > 0) {
            const keyStrToMatch = this.stringifyKey(query.partitionKey);
            for (const partition of partitions) {
                if (this.stringifyKey(partition.groupBy) === keyStrToMatch) {
                    const listUri = this.getCollectionPageUri(collection.uri, partition.groupBy);
                    pages.push({
                        key: partition.groupBy,
                        pages: await this.paginatePartition(listUri, partition.feed, pageSize)
                    });
                }
            }
            throw new Error(`No partition found for ${uri.path}?${uri.query.toString()}`);
        }
        for (const partition of partitions) {
            const listUri = this.getCollectionPageUri(collection.uri, partition.groupBy);
            pages.push({
                key: partition.groupBy ? partition.groupBy : null,
                pages: await this.paginatePartition(listUri, partition.feed, pageSize)
            });
        }
        return pages;
    }

    private serialize(listUri: string, feed: any[], nav: boolean) {
        if (nav) {
            return feed
            .filter(item => item[JSONLD_TYPE] === "WebPage")
            .map(page => ({
                [JSONLD_TYPE]: "SiteNavigationElement",
                name: page.mainEntity.name ? page.mainEntity.name : page.mainEntity.headline,
                url: page.url
            }));
        }
        return this.serializeItemList(listUri, feed);
    }

    private async paginatePartition(listUri: string, feed: any[], pageSize: number) {
        const pages = [];
        let currentIndex = 0;
        let prevItem = null;
        while(currentIndex < feed.length) {
            const start = currentIndex;
            const end = Math.min(start + pageSize, feed.length);
            const position = pages.length;
            const slice = feed.slice(start, end);
            const item = this.serializeListItem(listUri, slice, prevItem, position);
            prevItem = item;
            pages.push(item);
            currentIndex = end;
        }
        return pages;
    }

    private serializeListItem(listUri: string, slice: any[], prevItem: any, position: number) {
        const item: any = {
            // [JSONLD_ID]: `${listUri}/container`,
            [JSONLD_TYPE]: "ListItem",
            item: this.serializeItemList(`${listUri}/${position + 1}`, slice),
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

    private serializeItemList(listUri: string, feed: any[]) {
        return {
            [JSONLD_ID]: listUri,
            [JSONLD_TYPE]: "ItemList",
            itemListElement: feed.map(item => {
                return item[JSONLD_TYPE] === "WebPage" ? item.mainEntity : item
            })
        };
    }

    private getCollectionPageUri(collectionUri: string, partitionKey?: PartitionKey, pageIndex?: number) {
        const paths = [collectionUri];
        const params: any = partitionKey ? partitionKey : {};
        let queries = [];
        const fieldNames = Object.keys(params);
        fieldNames.sort();
        for (const name of fieldNames) {
            queries.push(`${encodeURIComponent(name)}=${encodeURIComponent(params[name])}`);
        }
        if (queries.length > 0) {
            paths.push(PARTITION_PATH);
            paths.push(queries.join("&"));
        }
        if (typeof(pageIndex) === "number") {
            paths.push(PAGE_PATH);
            paths.push(String(pageIndex + 1));
        }
        return paths.join("/");
    }

    private async build(collection: Collection) {
        if (this.collectionMap.has(collection.uri)) {
            return this.collectionMap.get(collection.uri);
        }

        const entityUris = this.collectionRoutes.get(collection.uri);
        let partitions: Partition[];
        if (collection.groupBy) {
            partitions = await this.addToPartitionedList(collection, entityUris);
        } else {
            partitions = await this.addToSingleList(entityUris);
        }

        if (collection.sort) {
            this.sortFeeds(partitions, collection.sort);
        }
        this.collectionMap.set(collection.uri, partitions);
        return partitions;
    }

    private async loadEntity(entityUri: EntityUri) {
        if (entityUri.type === EntityType.Page) {
            return await this.router.getPage(entityUri.path, false);
        }
        return await this.uriResolver.hydrateUri(entityUri.path);
    }

    private async addToSingleList(entityUris: EntityUri[]) {
        const feed = [];
        for (const entityUri of entityUris) {
            const item = await this.loadEntity(entityUri);
            feed.push(item);
        }
        return [{
            feed: feed
        }];
    }

    private async addToPartitionedList(collection: Collection, entityUris: EntityUri[]) {
        const partitionMap = new Map<string, Partition>();
        for (const entityUri of entityUris) {
            const item = await this.loadEntity(entityUri);
            const mainEntity = entityUri.type === EntityType.Page ? item.mainEntity : item;
            const partitions = collection.groupBy(mainEntity);
            if (Array.isArray(partitions)) {
                for (const partitionKey of partitions) {
                    const partition = this.getPartition(partitionMap, partitionKey);
                    partition.feed.push(item);
                }
            } else if (isObjectLiteral(partitions)) {
                const partition = this.getPartition(partitionMap, partitions);
                partition.feed.push(item);
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
            partition.feed.sort((pageA, pageB) => sort(pageA.mainEntity, pageB.mainEntity));
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
                typeof(partitionKey[name]) !== "number" &&
                !isJsDate(partitionKey[name])) {
                throw new Error(`Invalid partition key: ${JSON.stringify(partitionKey)} - Only string, number or date value allowed`);
            }
            keyStr += `${name}=${partitionKey[name]};`;
        }
        return keyStr;
    }
}