import {Observable, Subscriber} from "rxjs";
import {writeFile, readFile, safeParseJson, isNullOrUndefined, isDate, queryData} from "./utils";
import path from "path";
import shelljs from "shelljs";
import {ASC, DESC, SortBy, SambalData} from "./constants";

const INDEX_FILE = "index.json";

class Collection {
    private contentMap: Map<string, any>;
    private sortedContent: any[];
    private isIndexLoaded: boolean;
    constructor(private collectionPath: string, private sortBy?: SortBy[]) {
        this.contentMap = new Map<string, any>();
        this.sortedContent = [];
        this.isIndexLoaded = false;
    }

    async upsert(data: SambalData) {
        if (!this.isIndexLoaded) {
            await this.loadIndex();
        }
        const meta = {};
        if (this.sortBy) {
            for (const def of this.sortBy) {
                meta[def.field] = queryData(data, def.field);
            }
        }
        this.contentMap.set(data.url, {
            uri: data.url,
            meta: meta
        });
    }

    observe(): Observable<string>  {
        return new Observable(subscriber => {
            this.iterateIndex(subscriber);
        });
    }

    async size() {
        if (!this.isIndexLoaded) {
            await this.loadIndex();
        }
        return this.contentMap.size;
    }
    
    async iterateIndex(subscriber: Subscriber<string>) {
        if (!this.isIndexLoaded) {
            await this.loadIndex();
        }
        for (const meta of this.sortedContent) {
            subscriber.next(meta);
        }
        subscriber.complete();
    }


    async flush() {
        if (this.contentMap.size > 0) {
            this.sortedContent = [...this.contentMap.values()];
            this.sort(this.sortedContent);
            const output = this.getIndexFilePath();
            await writeFile(output, JSON.stringify(this.sortedContent));
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
            return 1;
        } else if (isNullOrUndefined(bValue)) {
            return -1;
        }
        return this.compareNonNullValues(aValue, bValue, order);
    }

    private compareNonNullValues(aValue: any, bValue: any, order: string) {
        if (isDate(aValue) && isDate(bValue)) {
            return order === ASC ? (aValue.getTime() - bValue.getTime()) : (bValue.getTime() - aValue.getTime());
        } else if (typeof(aValue) === "number" && typeof(bValue) === "number") {
            return order === ASC ? (aValue - bValue) : (bValue - aValue);
        }
        return order === ASC ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
    }

    private async loadIndex() {
        const indexFile = this.getIndexFilePath();
        if (shelljs.test("-e", indexFile)) {
            const metas = safeParseJson(await readFile(indexFile));
            if (metas) {
                for (const meta of metas) {
                    this.contentMap.set(meta.uri, meta);
                }
                this.sortedContent = [...metas];
            }
        }
        this.isIndexLoaded = true;
    }

    private getIndexFilePath(): string {
        return path.join(this.collectionPath, INDEX_FILE);
    }

}

export default Collection;