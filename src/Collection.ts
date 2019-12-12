import {Observable, Subscriber} from "rxjs";
import {writeFile, readFile, safeParseJson} from "./Utils";
import path from "path";
import shelljs from "shelljs";

const INDEX_FILE = "index.json";

class Collection {
    private contentMap: Map<string, any> = new Map<string, any>();
    constructor(private cacheRoot: string, private collectionPath: string, private sortBy?: string | string[]) {
        
    }

    add(data) {
        const meta = {id: data.id};
        if (this.sortBy) {
            if (typeof(this.sortBy) === "string") {
                meta[this.sortBy] = data[this.sortBy];
            } else if (Array.isArray(this.sortBy)) {
                for (const field of this.sortBy) {
                    meta[field] = data[field];
                }
            }
        }
        this.contentMap.set(data.id, meta);
    }

    observe(): Observable<string>  {
        return new Observable(subscriber => {
            this.iterateIndex(subscriber);
        });
    }

    async iterateIndex(subscriber: Subscriber<string>) {
        const indexFile = this.getIndexFilePath();
        if (shelljs.test("-e", indexFile)) {
            const files = safeParseJson(await readFile(indexFile));
            if (files) {
                files.forEach(f => subscriber.next(f.id));
            }
        }
        subscriber.complete();
    }


    async flush() {
        if (this.contentMap.size > 0) {
            const values = [...this.contentMap.values()];
            const output = this.getIndexFilePath();
            shelljs.mkdir("-p", path.dirname(output));
            await writeFile(output, JSON.stringify(values));
        }
    }

    private getIndexFilePath(): string {
        return path.normalize(`${this.cacheRoot}/${this.collectionPath}/${INDEX_FILE}`);
    }

}

export default Collection;