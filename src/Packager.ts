import {Observable, pipe} from "rxjs";
import {mergeMap, filter} from "rxjs/operators";
import {OUTPUT_FOLDER} from "./constants";
import {writeFile, isExternalSource} from "./utils";
import path from "path";
import prettier from "prettier";

type BundleFunction = (srcFile: string, destFolder: string) => Promise<string>
const DEFAULT_OPTIONS = {
    prettyHtml: true,
    bundle: async (srcFile: string, destFolder: string) => {
        return path.join(OUTPUT_FOLDER, srcFile);
    }
};

class Packager {
    private bundledFileMap: Map<string, Promise<string>> = new Map<string, Promise<string>>(); // map a src file to dest file
    constructor(private obs$: Observable<any>, private options: {prettyHtml?: boolean, bundle?: BundleFunction} = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
    }

    async deliver() {
        return new Promise((resolve, reject) => {
            this.obs$
            .pipe(this.bundleJsFiles())
            .pipe(filter(d => d.html !== null))
            .pipe(this.outputHtml())
            .subscribe({
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

    private bundleJsFiles() {
        return pipe(
            mergeMap(async (d: {path: string, data: any, html: CheerioStatic}) => {
                let html = null;
                if (d.html) {
                    const bundleJobs = this.getBundlePromises(d.html);
                    if (bundleJobs.length > 0) {
                        const dests = await Promise.all(bundleJobs.map(d => d.promise));
                        for (let i = 0; i < bundleJobs.length; i++) {
                            const node = bundleJobs[i].node;
                            node.attr("src", path.relative(OUTPUT_FOLDER, dests[i]));
                        }
                    }
                    html = d.html.html();
                    if (this.options.prettyHtml) {
                        html = prettier.format(html, {parser: "html"});
                    }
                }
                return {path: d.path, html: html};
            })
        );
    }

    private getBundlePromises($: CheerioStatic): {node: Cheerio, promise: Promise<string>}[] {
        const scriptSelector = 'script[src]';
        const entriesToBundle = [];
        const self = this;
        $(scriptSelector).each(function() {
            //TODO: Normalize jsFile
            const jsFile = $(this).attr("src");
            if (isExternalSource(jsFile)) {
                return;
            }
            if (!self.bundledFileMap.has(jsFile)) {
                const promise = self.options.bundle(jsFile, OUTPUT_FOLDER);
                self.bundledFileMap.set(jsFile, promise);
                entriesToBundle.push({
                    node: $(this),
                    promise: promise
                });
            } else {
                entriesToBundle.push({
                    node: $(this),
                    promise: self.bundledFileMap.get(jsFile)
                });
            }
        });
        return entriesToBundle;
    }

    private outputHtml() {
        return pipe(
            mergeMap(async (d: {path: string, html: string}) => {
                const basename = path.basename(d.path, path.extname(d.path));
                return await this.write(`${OUTPUT_FOLDER}/${path.dirname(d.path)}/${basename}`, d.html);
            })
        );
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
}

export default Packager;