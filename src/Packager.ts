import {Observable, pipe} from "rxjs";
import {mergeMap, filter} from "rxjs/operators";
import {OUTPUT_FOLDER, SambalData} from "./constants";
import {writeFile, isExternalSource, getUriPath} from "./utils";
import path from "path";
import prettier from "prettier";

type BundleFunction = (srcFile: string, destFolder: string, isModule: boolean) => Promise<string[]>;
const DEFAULT_OPTIONS = {
    prettyHtml: true,
    bundle: async (srcFile: string, destFolder: string) => {
        return [srcFile];
    }
};

class Packager {
    private bundledFileMap: Map<string, Promise<string[]>> = new Map<string, Promise<string[]>>(); // map a src file to dest file
    constructor(private obs$: Observable<SambalData>, private options: {prettyHtml?: boolean, bundle?: BundleFunction} = {}) {
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
        return pipe<Observable<SambalData>, Observable<{base: string, uri: string, data: any, html: string}>>(
            mergeMap(async (data: SambalData) => {
                let html = null;
                if (data.html) {
                    const bundleJobs = this.getBundlePromises(data.html);
                    if (bundleJobs.length > 0) {
                        const dests = await Promise.all(bundleJobs.map(d => d.promise));
                        for (let i = 0; i < bundleJobs.length; i++) {
                            const node = bundleJobs[i].node;
                            const assets = dests[i];
                            this.addAssetsToDOM(assets, data.html, node);
                        }
                    }
                    html = data.html.html();
                    if (this.options.prettyHtml) {
                        html = prettier.format(html, {parser: "html"});
                    }
                }
                return {base: data.base, uri: data.uri, data: data.data, html: html};
            })
        );
    }

    private addAssetsToDOM(assets: string[], $: CheerioStatic, originalScriptNode: Cheerio) {
        for (let i = 0; i < assets.length; i++) {
            $(originalScriptNode.clone()).insertAfter(originalScriptNode).attr("src", assets[i]);
        }
        originalScriptNode.remove();
    }

    private getBundlePromises($: CheerioStatic): {node: Cheerio, promise: Promise<string[]>}[] {
        const scriptSelector = 'script[src]';
        const entriesToBundle = [];
        const self = this;
        $(scriptSelector).each(function() {
            //TODO: Normalize jsFile
            const jsFile = $(this).attr("src");
            const isModule = $(this).attr("type") === "module";
            if (!jsFile || isExternalSource(jsFile)) {
                return;
            }
            if (!self.bundledFileMap.has(jsFile)) {
                const promise = self.options.bundle(jsFile, OUTPUT_FOLDER, isModule);
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
        return pipe<Observable<{base: string, uri: string, data: any, html: string}>, Observable<string>>(
            mergeMap(async (d) => {
                const uriPath = getUriPath(d.base, d.uri, d.data);
                return await this.write(path.join(OUTPUT_FOLDER, uriPath), d.html);
            })
        );
    }

    private async write(dest: string, content: string) {
        const ext = path.extname(dest).toLowerCase();
        let output = dest;
        if (ext !== '.html' && ext !== '.htm') {
            output = `${dest}/index.html`;
        }
        await writeFile(output, content);
        return output;
    }
}

export default Packager;