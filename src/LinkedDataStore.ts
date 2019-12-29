
import {Observable, Subscriber, empty, pipe, from, of, ConnectableObservable} from "rxjs";
import {mergeMap, filter, mergeAll, publish} from "rxjs/operators";
import shelljs from "shelljs";
import path from "path";
import fs from "fs";
import {cloneDeep, isEqual} from "lodash";
import {CACHE_FOLDER, ASC, DESC, SortBy, CollectionDef, SambalData} from "./constants";
import {
    loadContent,
    writeFile,
    isNullOrUndefined,
    isNonEmptyString,
    isObjectLiteral,
    safeParseJson,
    queryData,
    isSupportedFile,
    getUriPath,
    readFile
} from "./utils";
import Collection from "./Collection";
import {hydrateJsonLd} from "sambal-jsonld";
import Partitions from "./Partitions";

shelljs.config.silent = true;

type StoreOptions = {
    contentPath?: string | string[],
    content$?: Observable<any>,
    collections?: CollectionDef[],
};

const CONFIG_FILE = "config.json";
const COLLECTIONS_CACHE = `${CACHE_FOLDER}/collections`;
/*
const DEFAULT_COLLECTION: CollectionDef = {
    name: "main",
    sortBy: [{field: "dateCreated", order: DESC}]
};*/

class LinkedDataStore {
    private options: StoreOptions;
    private didConfigChanged: boolean = false;
    private collectionMap = new Map<string, Collection>(); // map collection path to Collection
    private partitionMap = new Map<string, Partitions>(); // map collection name to partitions
    private observablesToStart: ConnectableObservable<any>[] = [];
    constructor(private host: string, private userOptions: StoreOptions = {}) {
        this.options = {
            ...userOptions,
            collections: []
        };
        if (this.userOptions.collections && this.userOptions.collections.length > 0) {
            const updatedCollections = [];
            // const allIndex = cloneDeep(DEFAULT_COLLECTION);
            // updatedCollections.push(allIndex);
            for (const collection of this.userOptions.collections) {
                if (isNonEmptyString(collection.name)) {
                    updatedCollections.push({
                        name: collection.name,
                        sortBy: this.deepCopySortBy(collection.sortBy),
                        groupBy: this.sortGroupBy(collection.groupBy)
                    });
                } else {
                    console.log(`Ignoring collection with no name: ${JSON.stringify(collection)}`);
                }
            }
            this.options.collections = updatedCollections;
        }
        // this.didConfigChanged = !this.ensureConfigIsSame();
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
                    console.error(`Group by fields need to be a non-empty string: ${field}`);
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
        console.error(`Invalid sortBy: ${JSON.stringify(sortBy)}`);
        return false;
    }

    async indexContent() {
        return new Promise((resolve, reject) => {
            shelljs.rm("-rf", CACHE_FOLDER);
            if (this.options.collections.length === 0) {
                console.log("No collections defined.  Indexing not required");
                resolve();
            }
            this.getSourceObservable()
            .pipe(this.iterateCollection())
            .subscribe({
                next: (d: any) => console.log("Processed " + d.uri),
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

    content(): Observable<any> {
        const obs$: ConnectableObservable<any> = this.getSourceObservable().pipe(publish()) as ConnectableObservable<any>;
        this.observablesToStart.push(obs$);
        return obs$;
    }

    private getSourceObservable(): Observable<any> {
        const localContent$ = this.localData$();
        const moreContent$ = this.options.content$ ? this.options.content$ : empty();
        return from([localContent$, moreContent$]).pipe(mergeAll());
    }

    private localData$() {
        let localContent$: Observable<any> = empty();
        if (this.options.contentPath) {
            localContent$ = Array.isArray(this.options.contentPath) ? from(this.options.contentPath) : of(this.options.contentPath);
        }
        return localContent$.pipe(mergeMap((contentPath: any) => {
            const files = shelljs.ls("-R", contentPath);
            return new Observable(subscriber => {
                this.loadLocalFiles(contentPath, files, subscriber);
            });
        }));
    }

    private async loadLocalFiles(contentPath: string, files: string[], subscriber: Subscriber<any>) {
        for (const file of files) {
            if (isSupportedFile(file)) {
                const content = await this.load(path.join(contentPath, file), {base: contentPath});
                subscriber.next(content);
            }
        }
        subscriber.complete();
    }

    private collectionMetas(name: string, partition?: object): Observable<any> {
        if (this.didConfigChanged) {
            return empty();
        }
        const def = this.getCollectionDef(name);
        if (!def) {
            return empty();
        }
        let collectionPath;
        if (partition) {
            const partitions = this.getPartitions(def);
            collectionPath = LinkedDataStore.getCollectionPath(name, partitions.getPartitionKey(partition));
        } else {
            collectionPath = LinkedDataStore.getCollectionPath(name);
        }
        const collection = this.getCollection(collectionPath, def.sortBy as SortBy[]);
        const sourceObs = collection.observe();
        return sourceObs;
    }

    collection(name: string, partition?: object): Observable<any> {
        const obs$ = this.collectionMetas(name, partition)
        .pipe(filter(meta => {
            return shelljs.test("-e", meta.uri);
        }))
        .pipe(mergeMap(async meta => await this.load(meta.uri, {base: meta.base})))
        .pipe(publish()) as ConnectableObservable<any>;
        this.observablesToStart.push(obs$);
        return obs$;
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
                    const collectionPath = LinkedDataStore.getCollectionPath(collectionName, partitionKey);
                    const collection = this.getCollection(collectionPath, def.sortBy as SortBy[]);
                    const size = await collection.size();
                    partitionSizes.push({
                        partition: cloneDeep(partition.meta),
                        size: size
                    });
                }
                return {
                    partitions: partitionSizes
                };
            }
            const collectionPath = LinkedDataStore.getCollectionPath(collectionName);
            const collection = this.getCollection(collectionPath, def.sortBy as SortBy[]);
            const size = await collection.size();
            return {
                size: size
            };
        }
        throw new Error(`Collection ${collectionName} not found`);
    }

    private getCollectionDef(collectionName: string) {
        return this.options.collections.find(c => c.name === collectionName);
    }

    start() {
        for (const obs$ of this.observablesToStart) {
            obs$.connect();
        }
        this.observablesToStart = [];
    }

    async load(uri: string, options?: {base?: string}): Promise<SambalData> {
        const content = await loadContent(uri);
        const hydratedJson = await hydrateJsonLd(content, async (url) => {
            if (isSupportedFile(url)) {
                return await loadContent(url);
            }
            return null;
        });
        if (!hydratedJson.url) {
            hydratedJson.url = path.join(this.host, getUriPath(options.base, uri, hydratedJson));
        }
        return {
            base: options.base,
            uri: uri,
            data: hydratedJson
        };
    }

    /*
    private async writeConfig() {
        const configPath = `${CACHE_FOLDER}/${CONFIG_FILE}`;
        await writeFile(configPath, JSON.stringify(this.options));
    }

    private ensureConfigIsSame() {
        const configPath = `${CACHE_FOLDER}/${CONFIG_FILE}`;
        if (shelljs.test("-e", configPath)) {
            const config = safeParseJson(fs.readFileSync(configPath, "utf-8"));
            const isSame = isEqual(config, this.options);
            if (!isSame) {
                console.error("Sambal config changed.  Need to re-index content first");
            }
            return isSame;
        }
        return false;
    }*/

    private iterateCollection() {
        return pipe(
            mergeMap(async (content: any) => {
                for (const collection of this.options.collections) {
                    if (collection.groupBy) {
                        await this.addToPartitionedCollection(content, collection);
                    } else {
                        await this.addToCollection(content, LinkedDataStore.getCollectionPath(collection.name), collection.sortBy as SortBy[]);
                    }
                }
                return content;
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
        const collectionPath = LinkedDataStore.getCollectionPath(collectionDef.name);
        const partitions = new Partitions(collectionPath, collectionDef.groupBy as string[]);
        this.partitionMap.set(collectionDef.name, partitions);
        return partitions;
    }

    private async addToCollection(content: any, collectionPath: string, sortBy?: SortBy[]) {
        const collection: Collection = this.getCollection(collectionPath, sortBy);
        await collection.upsert(content);
    }

    private async addToPartitionedCollection(content: any, collectionDef: CollectionDef) {
        const partitionKeys = LinkedDataStore.getPartitionKeys(content.data, collectionDef.groupBy as string[]);
        const partitions = this.getPartitions(collectionDef);
        for (const key of partitionKeys) {
            if (key) {
                partitions.add(key);
                const partitionKey = partitions.getPartitionKey(key);
                await this.addToCollection(
                    content,
                    LinkedDataStore.getCollectionPath(collectionDef.name, partitionKey),
                    collectionDef.sortBy as SortBy[]);
            }
        }
    }

    private static getCollectionPath(collectionName: string, partitionKey?: string) {
        if (partitionKey) {
            return path.join(COLLECTIONS_CACHE, encodeURIComponent(collectionName), partitionKey);
        }
        return path.join(COLLECTIONS_CACHE, encodeURIComponent(collectionName));
    }

    private static getPartitionKeys(data: any, groupBy: string[]) {
        const keys = groupBy.map(field => {
            const key = queryData(data, field);
            return LinkedDataStore.stringifyKey(key);
        });
        return LinkedDataStore.iterateKeyCombination(groupBy, keys);
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
                    partitionKey[groupByFields[i]] = LinkedDataStore.stringifyKey(value[--indexes[i]]);
                } else {
                    partitionKey[groupByFields[i]] = LinkedDataStore.stringifyKey(value);
                }
            }
            partitionKeys.push(partitionKey);
            isDone = indexes.filter(i => i > 0).length === 0; 
        }
        return partitionKeys;
    }

    private static stringifyKey(value: any) {
        if (Array.isArray(value)) {
            return value.map(v => LinkedDataStore.stringifyKey(v));
        }
        return isNullOrUndefined(value) ? "" : String(value);
    }

}

export default LinkedDataStore;
