
import {Observable} from "rxjs";
import shelljs from "shelljs";
import path from "path";

const DEFAULT_OPTIONS = {
    base: "http://localhost",
    collections: [
        {
            name: "outbox",
            sortBy: ["dateCreated"]
        }
    ]
};

class Sambal {
    private options;
    constructor(private contentRoot: string, private userOptions: any = {}) {
        this.options = {
            base: userOptions.base ? userOptions.base : DEFAULT_OPTIONS.base,
            collections: Array.isArray(userOptions.collections) ? [...DEFAULT_OPTIONS.collections, ...userOptions.collections] : DEFAULT_OPTIONS.collections
        };
    }

    addContent(data: any) {

    }

    deleteContent(id: string) {

    }

    indexContent() {
        const files = shelljs.ls("-R", `${this.contentRoot}`);
        console.log(files);
    }

    collection(name: string): Observable<any> {
        return null;
    } 


}

export default Sambal;
