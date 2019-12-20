
import {Observable, Subscriber, empty, pipe, from, of} from "rxjs";
import {mergeMap, filter} from "rxjs/operators";
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
    isSupportedFile
} from "./utils";
import Collection from "./Collection";
import {hydrateJsonLd} from "sambal-jsonld";

shelljs.config.silent = true;

const CONFIG_FILE = "config.json";
const DEFAULT_COLLECTION = {
    name: "main",
    sortBy: [{field: "dateCreated", order: DESC}]
};

class LinkedDataStore {
    private options;
    private didConfigChanged: boolean = false;
    private collectionMap = new Map<string, Collection>();
    constructor(private obs$: Observable<any>, private userOptions: any = {}) {
        this.options = {
            collections: [DEFAULT_COLLECTION]
        };
        if (this.userOptions.collections) {
            const updatedCollections = [];
            const allIndex = cloneDeep(DEFAULT_COLLECTION);
            updatedCollections.push(allIndex);
            for (const collection of this.userOptions.collections) {
                if (collection.name === allIndex.name) {
                    allIndex.sortBy = this.deepCopySortBy(collection.sortBy);
                } else if (isNonEmptyString(collection.name)) {
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
        this.didConfigChanged = !this.ensureConfigIsSame();
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
            this.obs$
            .pipe(mergeMap(fieldValue => Array.isArray(fieldValue) ? from(fieldValue) : of(fieldValue)))
            .pipe(LinkedDataStore.loadData())
            .subscribe({
                next: (d: any) => this.iterateCollection(d),
                complete: async () => {
                    for (const collection of this.collectionMap.values()) {
                        await collection.flush();
                    }
                    await this.writeConfig();
                    resolve();
                },
                error: (err) => {
                    reject(err);
                }
            });
        });
    }

    private static loadData() {
        return pipe(
            mergeMap((d: any) => {
                if (typeof(d) === "string") {
                    const files = shelljs.ls("-R", d);
                    return new Observable(subscriber => {
                        LinkedDataStore.loadLocalFiles(files, subscriber);
                    });
                }
                return of(d);
            })
        );
    }

    private static async loadLocalFiles(files, subscriber: Subscriber<any>) {
        for (const file of files) {
            const content = await LinkedDataStore.loadAndHydrate(file);
            subscriber.next(content);
        }
        subscriber.complete();
    }

    collectionIds(name: string, partitionKey?: string): Observable<any> {
        if (this.didConfigChanged) {
            return empty();
        }
        const collectionPath = LinkedDataStore.getCollectionPath(name, partitionKey);
        const collection = new Collection(CACHE_FOLDER, collectionPath);
        const sourceObs = collection.observe();
        return sourceObs;
    }

    collection(name: string, partitionKey?: string): Observable<any> {
        return this.collectionIds(name, partitionKey)
        .pipe(filter(filePath => shelljs.test("-e", filePath)))
        .pipe(mergeMap(async filePath => await LinkedDataStore.loadAndHydrate(filePath)));
    }

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
    }

    async getData(filePath: string) {
        if (shelljs.test("-e", filePath)) {
            return await LinkedDataStore.loadAndHydrate(filePath);
        }
        return null;
    }

    static async loadAndHydrate(filePath: string) {
        const content = await loadContent(filePath);
        const hydratedJson = await hydrateJsonLd(content, async (url) => {
            if (isSupportedFile(url)) {
                return await loadContent(url);
            }
            return null;
        });
        return {
            path: filePath,
            data: hydratedJson
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
    }

    private iterateCollection(content: any) {
        for (const collection of this.options.collections) {
            if (collection.groupBy) {
                this.addToPartitionedCollection(content, collection);
            } else {
                this.addToCollection(content, LinkedDataStore.getCollectionPath(collection.name), collection.sortBy);
            }
        }
    }

    private addToCollection(content: any, collectionPath: string, sortBy?) {
        let collection: Collection;
        if (this.collectionMap.has(collectionPath)) {
            collection = this.collectionMap.get(collectionPath);
        } else {
            collection = new Collection(CACHE_FOLDER, collectionPath, sortBy);
            this.collectionMap.set(collectionPath, collection);
        }
        collection.upsert(content);
    }

    private addToPartitionedCollection(content: any, collectionDef: any) {
        const partitionKeys = LinkedDataStore.getPartitionKeys(content.data, collectionDef.groupBy);
        for (const key of partitionKeys) {
            if (key) {
                this.addToCollection(content, LinkedDataStore.getCollectionPath(collectionDef.name, key), collectionDef.sortBy);
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