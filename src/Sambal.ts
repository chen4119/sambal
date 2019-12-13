
import {Observable} from "rxjs";
import {mergeMap, filter, map} from "rxjs/operators";
import shelljs from "shelljs";
import path from "path";
import url from "url";
import {cloneDeep} from "lodash";
import {CACHE_FOLDER} from "./Constants";
import {loadContent, isNullOrUndefined, isNonEmptyString, isObjectLiteral} from "./Utils";
import Collection from "./Collection";

shelljs.config.silent = true;

const DEFAULT_COLLECTION = {
    name: "main",
    sortBy: [{field: "dateCreated", order: "desc"}]
};
const DEFAULT_BASE = "http://localhost";

class Sambal {
    private options;
    private collectionMap = new Map<string, Collection>();
    constructor(private contentRoot: string, private userOptions: any = {}) {
        this.options = {
            base: this.userOptions.base ? this.userOptions.base : DEFAULT_BASE,
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
        if (typeof(sortBy.field) === "string" && sortBy.order === "desc" || sortBy.order === "asc") {
            return true;
        }
        console.error(`Invalid sortBy: ${JSON.stringify(sortBy)}`);
        return false;
    }

    async indexContent() {
        const files = shelljs.ls("-R", [
            `${this.contentRoot}/**/*.md`, 
            `${this.contentRoot}/**/*.yml`, 
            `${this.contentRoot}/**/*.yaml`
        ]);
        for (const file of files) {
            await this.indexFile(file);
        }
        for (const collection of this.collectionMap.values()) {
            await collection.flush();
        }
    }

    collectionIds(name: string, partitionKey?: string): Observable<any> {
        let collectionPath = name;
        if (partitionKey) {
            collectionPath = `${name}/${partitionKey}`;
        }
        const collection = new Collection(CACHE_FOLDER, collectionPath);
        const sourceObs = collection.observe();
        return sourceObs;
    }

    collection(name: string, partitionKey?: string): Observable<any> {
        return this.collectionIds(name, partitionKey)
        .pipe(map(uri => path.normalize(`${this.contentRoot}/${url.parse(uri).pathname}`)))
        .pipe(filter(filePath => shelljs.test("-e", filePath)))
        .pipe(mergeMap(async filePath => await loadContent(filePath)));
    }

    getPartitions(collectionName: string) {

    }

    private async indexFile(src: string) {
        const content = await loadContent(src);
        content.id = `${this.options.base}/${path.relative(this.contentRoot, src)}`;
        this.iterateCollection(content);
    }

    private iterateCollection(content: any) {
        for (const collection of this.options.collections) {
            if (collection.groupBy) {
                this.addToPartitionedCollection(content, collection);
            } else {
                this.addToCollection(content, collection.name, collection.sortBy);
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
        const partitionKeys = this.getPartitionKeys(content, collectionDef.groupBy);
        for (const key of partitionKeys) {
            if (key) {
                this.addToCollection(content, `${collectionDef.name}/${key}`, collectionDef.sortBy);
            }
        }
    }

    private getPartitionKeys(content: any, groupBy: string[]) {
        const values = groupBy.map(key => this.stringifyKey(content[key]));
        return this.iteratePartitionKeys(values);
    }

    private iteratePartitionKeys(values) {
        const allKeys = [];
        const indexes = values.map(d => 0);
        while (true) {
            const keySegments = [];
            for (let i = 0; i < values.length; i++) {
                const index = indexes[i];
                const value = values[i];
                if (Array.isArray(value)) {
                    keySegments.push(this.stringifyKey(value[index]));
                    indexes[i]++;
                } else {
                    keySegments.push(this.stringifyKey(value));
                }
            }
            allKeys.push(keySegments.join("-"));
            let isDone = true;
            for (let i = 0; i < values.length; i++) {
                const index = indexes[i];
                const value = values[i];
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

    private stringifyKey(value: any) {
        if (Array.isArray(value)) {
            return value.map(v => this.stringifyKey(v));
        }
        return isNullOrUndefined(value) ? "" : encodeURIComponent(String(value));
    }

}

export default Sambal;
