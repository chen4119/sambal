
import {Observable, empty, pipe} from "rxjs";
import {mergeMap, filter, map} from "rxjs/operators";
import shelljs from "shelljs";
import path from "path";
import {cloneDeep} from "lodash";
import {CACHE_FOLDER, ASC, DESC, SortBy, CollectionDef, SambalData} from "./constants";
import {
    isNullOrUndefined,
    isNonEmptyString,
    isObjectLiteral,
    queryData
} from "./utils";
import Collection from "./Collection";
import Partitions from "./Partitions";
import Logger from "./Logger";

shelljs.config.silent = true;

type StoreOptions = {
    cacheFolder?: string
};

// const CONFIG_FILE = "config.json";

class SambalCollection {
    private collectionDefs: CollectionDef[];
    private collectionMap: Map<string, Collection>; // map collection path to Collection
    private partitionMap: Map<string, Partitions>; // map collection name to partitions
    private cacheFolder: string;
    private log: Logger;

    constructor(private collections: CollectionDef[], private userOptions: StoreOptions = {}) {
        this.log = new Logger({name: "SambalCollection"});
        this.collectionDefs = [];
        this.collectionMap = new Map<string, Collection>();
        this.partitionMap = new Map<string, Partitions>();
        this.cacheFolder = CACHE_FOLDER;
        if (this.userOptions.cacheFolder) {
            this.cacheFolder = this.userOptions.cacheFolder;
        }
        for (const collection of this.collections) {
            if (isNonEmptyString(collection.name)) {
                this.collectionDefs.push({
                    name: collection.name,
                    sortBy: this.deepCopySortBy(collection.sortBy),
                    groupBy: this.sortGroupBy(collection.groupBy)
                });
            } else {
                this.log.warn(`Ignoring collection with no name: ${JSON.stringify(collection)}`);
            }
        }
    }

    private sortGroupBy(groupBy) {
        if (isNonEmptyString(groupBy)) {
            return [groupBy];    
        } else if (Array.isArray(groupBy)) {
            const validatedGroupBy = [];
            for (const field of groupBy) {
                if (isNonEmptyString(field)) {
                    validatedGroupBy.push(field);
                } else {
                    this.log.warn(`Group by fields need to be a non-empty string: ${field}`);
                }
            }
            validatedGroupBy.sort();
            return validatedGroupBy;
        }
        return null;
    }

    private deepCopySortBy(sortBy) {
        if (isObjectLiteral(sortBy) && this.validateSortByField(sortBy)) {
            return [sortBy];
        } else if (Array.isArray(sortBy)) {
            const validatedSortBy = [];
            for (const field of sortBy) {
                if (this.validateSortByField(field)) {
                    validatedSortBy.push(cloneDeep(field));
                }
            }
            return validatedSortBy;
        }
        return null;
    }

    private validateSortByField(sortBy) {
        if (typeof(sortBy.field) === "string" && sortBy.order === DESC || sortBy.order === ASC) {
            return true;
        }
        this.log.warn(`Invalid sortBy: ${JSON.stringify(sortBy)}`);
        return false;
    }

    async indexContent(content$: Observable<any>) {
        return new Promise((resolve, reject) => {
            shelljs.rm("-rf", this.cacheFolder);
            content$
            .pipe(filter(d => {
                if (!d.url) {
                    this.log.warn("Ignoring data with no url");
                    this.log.warn(d);
                    return false;
                }
                return true;
            }))
            .pipe(this.iterateCollection())
            .subscribe({
                next: (d: any) => this.log.info("Processed " + d.url),
                complete: async () => {
                    for (const collection of this.collectionMap.values()) {
                        await collection.flush();
                    }
                    for (const partitions of this.partitionMap.values()) {
                        await partitions.flush();
                    }
                    // await this.writeConfig();
                    resolve();
                },
                error: (err) => {
                    reject(err);
                }
            });
        });
    }

    private collectionMetas(name: string, partition?: object): Observable<any> {
        const def = this.getCollectionDef(name);
        if (!def) {
            return empty();
        }
        let collectionPath;
        if (partition) {
            const partitions = this.getPartitions(def);
            collectionPath = this.getCollectionPath(name, partitions.getPartitionKey(partition));
        } else {
            collectionPath = this.getCollectionPath(name);
        }
        const collection = this.getCollection(collectionPath, def.sortBy as SortBy[]);
        const sourceObs = collection.observe();
        return sourceObs;
    }

    collection(name: string, partition?: object): Observable<any> {
        return this.collectionMetas(name, partition)
        .pipe(map(d => d.uri));
    }

    async stats(collectionName: string) {
        const def = this.getCollectionDef(collectionName);
        if (def) {
            if (def.groupBy) {
                const partitions = this.getPartitions(def);
                const partitionList = await partitions.list();
                const partitionSizes = [];
                for (const partition of partitionList) {
                    const partitionKey = partitions.getPartitionKey(partition.meta);
                    const size = await this.getCollectionSize(def, partitionKey);
                    partitionSizes.push({
                        partition: cloneDeep(partition.meta),
                        size: size
                    });
                }
                return {
                    partitions: partitionSizes
                };
            }
            const size = await this.getCollectionSize(def);
            return {size: size};
        }
        throw new Error(`Collection ${collectionName} not found`);
    }

    private async getCollectionSize(collectionDef: CollectionDef, partitionKey?: string) {
        const collectionPath = this.getCollectionPath(collectionDef.name, partitionKey);
        const collection = this.getCollection(collectionPath, collectionDef.sortBy as SortBy[]);
        return await collection.size();
    }

    private getCollectionDef(collectionName: string) {
        return this.collectionDefs.find(c => c.name === collectionName);
    }

    private iterateCollection() {
        return pipe<Observable<SambalData>, Observable<SambalData>>(
            mergeMap(async (data) => {
                for (const collection of this.collectionDefs) {
                    if (collection.groupBy) {
                        await this.addToPartitionedCollection(data, collection);
                    } else {
                        await this.addToCollection(data, this.getCollectionPath(collection.name), collection.sortBy as SortBy[]);
                    }
                }
                return data;
            })
        );
    }

    private getCollection(collectionPath: string, sortBy?: SortBy[]): Collection {
        if (this.collectionMap.has(collectionPath)) {
            return this.collectionMap.get(collectionPath);
        }
        const collection = new Collection(collectionPath, sortBy);
        this.collectionMap.set(collectionPath, collection);
        return collection;
    }

    private getPartitions(collectionDef: CollectionDef): Partitions {
        if (this.partitionMap.has(collectionDef.name)) {
            return this.partitionMap.get(collectionDef.name);
        }
        const collectionPath = this.getCollectionPath(collectionDef.name);
        const partitions = new Partitions(collectionPath, collectionDef.groupBy as string[]);
        this.partitionMap.set(collectionDef.name, partitions);
        return partitions;
    }

    private async addToCollection(data: SambalData, collectionPath: string, sortBy?: SortBy[]) {
        const collection: Collection = this.getCollection(collectionPath, sortBy);
        await collection.upsert(data);
    }

    private async addToPartitionedCollection(data: SambalData, collectionDef: CollectionDef) {
        const partitionKeys = SambalCollection.getPartitionKeys(data, collectionDef.groupBy as string[]);
        const partitions = this.getPartitions(collectionDef);
        for (const key of partitionKeys) {
            partitions.add(key);
            const partitionKey = partitions.getPartitionKey(key);
            await this.addToCollection(
                data,
                this.getCollectionPath(collectionDef.name, partitionKey),
                collectionDef.sortBy as SortBy[]);
        }
    }

    private getCollectionPath(collectionName: string, partitionKey?: string) {
        const collectionFolder = `${this.cacheFolder}/collections`;
        if (partitionKey) {
            return path.join(collectionFolder, encodeURIComponent(collectionName), partitionKey);
        }
        return path.join(collectionFolder, encodeURIComponent(collectionName));
    }

    private static getPartitionKeys(data: SambalData, groupBy: string[]) {
        const keys = groupBy.map(field => {
            const key = queryData(data, field);
            return SambalCollection.stringifyKey(key);
        });
        return SambalCollection.iterateKeyCombination(groupBy, keys);
    }

    private static iterateKeyCombination(groupByFields: string[], groupByKeys) {
        const partitionKeys = [];
        const indexes = groupByKeys.map(key => Array.isArray(key) ? key.length : 0);
        let isDone = false;
        while (!isDone) {
            const partitionKey = {};
            for (let i = 0; i < groupByFields.length; i++) {
                const value = groupByKeys[i];
                if (Array.isArray(value)) {
                    partitionKey[groupByFields[i]] = SambalCollection.stringifyKey(value[--indexes[i]]);
                } else {
                    partitionKey[groupByFields[i]] = SambalCollection.stringifyKey(value);
                }
            }
            partitionKeys.push(partitionKey);
            isDone = indexes.filter(i => i > 0).length === 0; 
        }
        return partitionKeys;
    }

    private static stringifyKey(value: any) {
        if (Array.isArray(value)) {
            return value.map(v => SambalCollection.stringifyKey(v));
        }
        return isNullOrUndefined(value) ? "" : String(value);
    }

}

export default SambalCollection;
