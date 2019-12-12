
import {Observable} from "rxjs";
import {mergeMap, filter, map} from "rxjs/operators";
import shelljs from "shelljs";
import path from "path";
import url from "url";
import {CACHE_FOLDER} from "./Constants";
import {loadContent, isNullOrUndefined} from "./Utils";
import Collection from "./Collection";

shelljs.config.silent = true;

const OUTBOX = "outbox";
const DEFAULT_OPTIONS = {
    base: "http://localhost",
    collections: [
        {
            name: OUTBOX,
            sortBy: ["dateCreated"]
        }
    ]
};

class Sambal {
    private options;
    private collectionMap = new Map<string, Collection>();
    constructor(private contentRoot: string, private userOptions: any = {}) {
        this.options = {
            base: this.userOptions.base ? this.userOptions.base : DEFAULT_OPTIONS.base,
            collections: Array.isArray(this.userOptions.collections) ? 
            [...DEFAULT_OPTIONS.collections, ...this.userOptions.collections] : 
            DEFAULT_OPTIONS.collections
        };
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

    collection(name: string, partitionKey?: string): Observable<any> {
        let collectionPath = name;
        if (partitionKey) {
            collectionPath = `${name}/${partitionKey}`;
        }
        const collection = new Collection(CACHE_FOLDER, collectionPath);
        const sourceObs = collection.observe();
        return sourceObs
        .pipe(map(uri => path.normalize(`${this.contentRoot}/${url.parse(uri).pathname}`)))
        .pipe(filter(filePath => shelljs.test("-e", filePath)))
        .pipe(mergeMap(async filePath => await loadContent(filePath)));
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

    private addToCollection(content: any, collectionPath: string, sortBy?: string | string[]) {
        let collection: Collection;
        if (this.collectionMap.has(collectionPath)) {
            collection = this.collectionMap.get(collectionPath);
        } else {
            collection = new Collection(CACHE_FOLDER, collectionPath, sortBy);
            this.collectionMap.set(collectionPath, collection);
        }
        collection.add(content);
    }

    private addToPartitionedCollection(content: any, collectionDef: any) {
        const partitionKeys = this.getPartitionKeys(content, collectionDef.groupBy);
        for (const key of partitionKeys) {
            if (key) {
                this.addToCollection(content, `${collectionDef.name}/${key}`, collectionDef.sortBy);
            }
        }
    }

    private getPartitionKeys(content: any, groupBy: string | string[]) {
        if (typeof(groupBy) === "string") {
            return this.stringifyKey(content[groupBy]);
        } else if (Array.isArray(groupBy)) {
            const values = groupBy.map(key => this.stringifyKey(content[key]));
            return this.iteratePartitionKeys(values);
        }
        return [];
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
