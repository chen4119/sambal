import {Observable} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {OUTPUT_FOLDER} from "./constants";
import path from "path";

class Packager {
    private bundledFileMap: Map<string, string> = new Map<string, string>(); // map a src file to dest file
    constructor(private obs$: Observable<any>, private bundle: (srcFile: string, destFolder: string) => Promise<string>) {
        
    }

    build() {
        this.obs$
        .pipe(mergeMap(async (d: {path: string, data: any, html: CheerioStatic}) => {
                if (d.html) {
                    await this.parseHtml(d.html);
                }
                return d;
            })
        );
    }

    private async write(dest: string, content: string) {
        const ext = path.extname(dest).toLowerCase();
        let output = path.normalize(`${dest}/index.html`);
        if (ext === '.html' || ext === '.htm') {
            output = path.normalize(`${dest}`);
        }
        // await ensureDirectoryExistThenWriteFile(output, content);
        return output;
    }

    private async parseHtml($: CheerioStatic) {
        const scriptSelector = 'script[src]';
        const entriesToBundle = [];
        const self = this;
        $(scriptSelector).each(function() {
            const jsFile = $(this).attr("src");
            if (!self.bundledFileMap.has(jsFile)) {
                entriesToBundle.push(jsFile);
            }
        });
        for (const entry of entriesToBundle) {
            const output = await this.bundle(entry, OUTPUT_FOLDER);
            self.bundledFileMap.set(entry, output);
        }
        $(scriptSelector).each(function() {
            const jsFile = $(this).attr("src");
            if (self.bundledFileMap.has(jsFile)) {
                const bundledFilePath = self.bundledFileMap.get(jsFile);
                $(this).attr("src", path.relative(OUTPUT_FOLDER, bundledFilePath));
            }
        });
    }
}

export default Packager;