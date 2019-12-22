import {Observable, Subscriber} from "rxjs";
import {writeFile, readFile, safeParseJson, isNullOrUndefined, isDate, queryData, getFullPath} from "./utils";
import path from "path";
import shelljs from "shelljs";
import {ASC, DESC} from "./constants";

const INDEX_FILE = "index.json";

class Collection {
    private contentMap: Map<string, any> = new Map<string, any>();
    private isIndexLoaded: boolean = false;
    constructor(private cacheRoot: string, private collectionPath: string, private sortBy?) {
        
    }

    async upsert(content) {
        if (!this.isIndexLoaded) {
            await this.loadIndex();
        }
        const id = getFullPath(content.base, content.path);
        const meta = {};
        if (this.sortBy) {
            for (const def of this.sortBy) {
                meta[def.field] = queryData(content.data, def.field);
            }
        }
        this.contentMap.set(id, {
            base: content.base,
            path: content.path,
            meta: meta
        });
    }

    observe(): Observable<string>  {
        return new Observable(subscriber => {
            this.iterateIndex(subscriber);
        });
    }

    async iterateIndex(subscriber: Subscriber<string>) {
        if (!this.isIndexLoaded) {
            await this.loadIndex();
        }
        for (const meta of this.contentMap.values()) {
            subscriber.next(meta);
        }
        subscriber.complete();
    }


    async flush() {
        if (this.contentMap.size > 0) {
            const values = [...this.contentMap.values()];
            this.sort(values);
            const output = this.getIndexFilePath();
            await writeFile(output, JSON.stringify(values));
        }
    }

    private sort(values: any[]) {
        if (this.sortBy) {
            values.sort((a, b) => {
                for (let i = 0; i < this.sortBy.length; i++) {
                    const def = this.sortBy[i];
                    const aValue = queryData(a.meta, def.field);
                    const bValue = queryData(b.meta, def.field);
                    
                    let compareVal = this.compare(aValue, bValue, def.order);
                    if (compareVal !== 0 || i === this.sortBy.length - 1) {
                        return compareVal;
                    }
                }
            });
        }
    }

    private compare(aValue: any, bValue: any, order: string) {
        if (isNullOrUndefined(aValue) && isNullOrUndefined(bValue)) {
            return 0;
        } else if (isNullOrUndefined(aValue)) {
            return order === ASC ? 1 : -1;
        } else if (isNullOrUndefined(bValue)) {
            return order === ASC ? -1 : 1;
        }
        return this.compareNonNullValues(aValue, bValue, order);
    }

    private compareNonNullValues(aValue: any, bValue: any, order: string) {
        if ((isDate(aValue) && isDate(bValue)) || (typeof(aValue) === "number" && typeof(bValue) === "number")) {
            return order === ASC ? (aValue.getTime() - bValue.getTime()) : (bValue.getTime() - aValue.getTime());
        }
        return order === ASC ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
    }

    private async loadIndex() {
        const indexFile = this.getIndexFilePath();
        if (shelljs.test("-e", indexFile)) {
            console.log(`Loading index file ${indexFile}`);
            const metas = safeParseJson(await readFile(indexFile));
            if (metas) {
                for (const meta of metas) {
                    const id = getFullPath(meta.base, meta.path);
                    this.contentMap.set(id, meta);
                }
            }
        } else {
            console.log(`${indexFile} not found`);
        }
        this.isIndexLoaded = true;
    }

    static getRoot(cacheFolder: string) {
        return `${cacheFolder}/collections`;
    }

    private getIndexFilePath(): string {
        return path.normalize(`${Collection.getRoot(this.cacheRoot)}/${this.collectionPath}/${INDEX_FILE}`);
    }

}

export default Collection;