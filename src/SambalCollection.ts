
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
    private collectionDefs: CollectionDef[] = [];
    private collectionMap = new Map<string, Collection>(); // map collection path to Collection
    private partitionMap = new Map<string, Partitions>(); // map collection name to partitions
    // private observablesToStart: ConnectableObservable<any>[] = [];
    private cacheFolder: string = CACHE_FOLDER;
    private log: Logger = new Logger({name: "SambalCollection"});

    constructor(private collections: CollectionDef[], private userOptions: StoreOptions = {}) {
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

    /*
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
                try {
                    const content = await this.load(path.join(contentPath, file), {base: contentPath});
                    subscriber.next(content);
                } catch (e) {
                    this.log.error(`Error loading ${file}.  Ignoring...`);
                }
            }
        }
        subscriber.complete();
    }*/

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

    /*
    start() {
        for (const obs$ of this.observablesToStart) {
            obs$.connect();
        }
        this.observablesToStart = [];
    }*/

    /*
    async load(uri: string, options?: {base?: string}): Promise<SambalData> {
        const content = await loadContent(uri);
        const hydratedJson = await hydrateJsonLd(content, async (url) => {
            if (isSupportedFile(url)) {
                return await loadContent(url);
            }
            return null;
        });
        if (!hydratedJson.url) {
            hydratedJson.url = `${this.host}/${getUriPath(options.base, uri, hydratedJson)}`; // don't use path.join here.  http double slash will become single
        }
        return {
            ...hydratedJson,
            [SAMBAL_INTERNAL]: {
                base: options.base,
                uri: uri
            }
        };
    }

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
