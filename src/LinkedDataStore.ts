
import {Observable, Subscriber, empty, pipe, from, of, ConnectableObservable} from "rxjs";
import {mergeMap, filter, mergeAll, publish} from "rxjs/operators";
import shelljs from "shelljs";
import path from "path";
import fs from "fs";
import {cloneDeep, isEqual} from "lodash";
import {CACHE_FOLDER, ASC, DESC} from "./constants";
import {
    loadContent,
    writeFile,
    isNullOrUndefined,
    isNonEmptyString,
    isObjectLiteral,
    safeParseJson,
    queryData,
    isSupportedFile,
    getFullPath
} from "./utils";
import Collection from "./Collection";
import {hydrateJsonLd} from "sambal-jsonld";

shelljs.config.silent = true;

type SortBy = {
    field: string,
    order: "desc" | "asc"
};

export type CollectionDef = {
    name: string,
    sortBy?: SortBy | SortBy[],
    groupBy?: string | string[]
};

type StoreOptions = {
    contentPath?: string | string[],
    content$?: Observable<any>,
    collections?: CollectionDef[],
};

const CONFIG_FILE = "config.json";
/*
const DEFAULT_COLLECTION: CollectionDef = {
    name: "main",
    sortBy: [{field: "dateCreated", order: DESC}]
};*/

class LinkedDataStore {
    private options: StoreOptions;
    private didConfigChanged: boolean = false;
    private collectionMap = new Map<string, Collection>();
    private observablesToStart: ConnectableObservable<any>[] = [];
    constructor(private userOptions: StoreOptions = {}) {
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
                        groupBy: this.deepCopyGroupBy(collection.groupBy)
                    });
                } else {
                    console.log(`Ignoring collection with no name: ${JSON.stringify(collection)}`);
                }
            }
            this.options.collections = updatedCollections;
        }
        // this.didConfigChanged = !this.ensureConfigIsSame();
    }

    private deepCopyGroupBy(groupBy) {
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
            this.getSourceObservable()
            .pipe(this.iterateCollection())
            .subscribe({
                next: (d: any) => console.log("Processed " + d.path),
                complete: async () => {
                    for (const collection of this.collectionMap.values()) {
                        await collection.flush();
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
                const content = await this.load(contentPath, file);
                subscriber.next(content);
            }
        }
        subscriber.complete();
    }

    private collectionIds(name: string, partitionKey?: string): Observable<any> {
        if (this.didConfigChanged) {
            return empty();
        }
        const def = this.getCollectionDef(name);
        if (!def) {
            return empty();
        }
        const collectionPath = LinkedDataStore.getCollectionPath(name, partitionKey);
        const collection = this.getCollection(collectionPath, def.sortBy);
        const sourceObs = collection.observe();
        return sourceObs;
    }

    collection(name: string, partitionKey?: string): Observable<any> {
        const obs$ = this.collectionIds(name, partitionKey)
        .pipe(filter(meta => {
            return shelljs.test("-e", getFullPath(meta.base, meta.path));
        }))
        .pipe(mergeMap(async meta => await this.load(meta.base, meta.path)))
        .pipe(publish()) as ConnectableObservable<any>;
        this.observablesToStart.push(obs$);
        return obs$;
    }

    async stats(collectionName: string) {
        const def = this.getCollectionDef(collectionName);
        if (def) {
            if (def.groupBy) {
                const partitionKeys = LinkedDataStore.getCollectionPartitionKeys(collectionName);

            } else {
                const collectionPath = LinkedDataStore.getCollectionPath(name);
                const collection = this.getCollection(collectionPath, def.sortBy);
                const size = await collection.size();
                return {
                    size: size
                };
            }
        }
        throw new Error(`Collection ${collectionName} not found`);
    }

    private getCollectionDef(collectionName: string) {
        return this.options.collections.find(c => c.name === collectionName);
    }

    private static getCollectionPartitionKeys(collectionName: string) {
        return shelljs.ls("-d", `${Collection.getRoot(CACHE_FOLDER)}/${collectionName}/*`);
    }

    /*
    collectionPartitions(collectionName: string): Observable<any> {
        if (this.didConfigChanged) {
            return empty();
        }
        return new Observable(subscriber => {
            const dirs = shelljs.ls("-d", `${Collection.getRoot(CACHE_FOLDER)}/${collectionName}/*`);
            for (const dir of dirs) {
                subscriber.next(decodeURIComponent(path.basename(dir)));
            }
            subscriber.complete();
        });
    }*/

    start() {
        for (const obs$ of this.observablesToStart) {
            obs$.connect();
        }
        this.observablesToStart = [];
    }

    async load(base: string, filePath: string, isHydrate: boolean = true) {
        const fullPath = getFullPath(base, filePath);
        const content = await loadContent(fullPath);
        const hydratedJson = await hydrateJsonLd(content, async (url) => {
            if (isSupportedFile(url)) {
                return await loadContent(url);
            }
            return null;
        });
        return {
            base: base,
            path: filePath,
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
                        await this.addToCollection(content, LinkedDataStore.getCollectionPath(collection.name), collection.sortBy);
                    }
                }
                return content;
            })
        );
    }

    private getCollection(collectionPath: string, sortBy?): Collection {
        if (this.collectionMap.has(collectionPath)) {
            return this.collectionMap.get(collectionPath);
        }
        const collection = new Collection(CACHE_FOLDER, collectionPath, sortBy);
        this.collectionMap.set(collectionPath, collection);
        return collection;
    }

    private async addToCollection(content: any, collectionPath: string, sortBy?) {
        const collection: Collection = this.getCollection(collectionPath, sortBy);
        await collection.upsert(content);
    }

    private async addToPartitionedCollection(content: any, collectionDef: any) {
        const partitionKeys = LinkedDataStore.getPartitionKeys(content.data, collectionDef.groupBy);
        for (const key of partitionKeys) {
            if (key) {
                await this.addToCollection(content, LinkedDataStore.getCollectionPath(collectionDef.name, key), collectionDef.sortBy);
            }
        }
    }

    private static getCollectionPath(collectionName: string, partitionKey?: string) {
        let collectionPath = collectionName;
        if (partitionKey) {
            collectionPath = encodeURI(`${collectionName}/${partitionKey}`);
        }
        return collectionPath;
    }

    private static getPartitionKeys(data: any, groupBy: string[]) {
        const keys = groupBy.map(field => {
            const key = queryData(data, field);
            return LinkedDataStore.stringifyKey(key);
        });
        return LinkedDataStore.iteratePartitionKeys(keys);
    }

    private static iteratePartitionKeys(keys) {
        const allKeys = [];
        const indexes = keys.map(d => 0);
        while (true) {
            const keySegments = [];
            for (let i = 0; i < keys.length; i++) {
                const index = indexes[i];
                const value = keys[i];
                if (Array.isArray(value)) {
                    keySegments.push(LinkedDataStore.stringifyKey(value[index]));
                    indexes[i]++;
                } else {
                    keySegments.push(LinkedDataStore.stringifyKey(value));
                }
            }
            allKeys.push(keySegments.join("-"));
            let isDone = true;
            for (let i = 0; i < keys.length; i++) {
                const index = indexes[i];
                const value = keys[i];
                if (Array.isArray(value) && index < value.length) {
                    isDone = false;
                    break;
                }
            }
            if (isDone) {
                break;
            }
        }
        return allKeys;
    }

    private static stringifyKey(value: any) {
        if (Array.isArray(value)) {
            return value.map(v => LinkedDataStore.stringifyKey(v));
        }
        return isNullOrUndefined(value) ? "" : String(value);
    }

}

export default LinkedDataStore;
