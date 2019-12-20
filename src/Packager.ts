import {Observable} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {OUTPUT_FOLDER} from "./constants";
import {writeFile} from "./utils";
import path from "path";
import prettier from "prettier";

type BundleFunction = (srcFile: string, destFolder: string) => Promise<string>
const DEFAULT_OPTIONS = {
    prettyHtml: true,
    bundle: async (srcFile: string, destFolder: string) => {
        return srcFile;
    }
};

class Packager {
    private bundledFileMap: Map<string, string> = new Map<string, string>(); // map a src file to dest file
    constructor(private obs$: Observable<any>, private options: {prettyHtml?: boolean, bundle?: BundleFunction} = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
    }

    async deliver() {
        return new Promise((resolve, reject) => {
            this.obs$
            .pipe(mergeMap(async (d: {path: string, data: any, html: CheerioStatic}) => {
                if (d.html) {
                    await this.parseHtml(d.html);
                }
                let html = d.html.html();
                if (this.options.prettyHtml) {
                    html = prettier.format(d.html.html(), {parser: "html"});
                }
                return {path: d.path, html: html};
            })).pipe(mergeMap(async (d: {path: string, html: string}) => {
                const basename = path.basename(d.path, path.extname(d.path));
                return await this.write(`${OUTPUT_FOLDER}/${path.dirname(d.path)}/${basename}`, d.html);
            })).subscribe({
                next: (output: string) => console.log(`Wrote ${output}`),
                complete: async () => {
                    resolve();
                },
                error: (err) => {
                    reject(err);
                }
            });
        });
    }

    private async write(dest: string, content: string) {
        const ext = path.extname(dest).toLowerCase();
        let output = path.normalize(`${dest}/index.html`);
        if (ext === '.html' || ext === '.htm') {
            output = path.normalize(`${dest}`);
        }
        await writeFile(output, content);
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
            const output = await this.options.bundle(entry, OUTPUT_FOLDER);
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