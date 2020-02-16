import {Observable, pipe} from "rxjs";
import {mergeMap, filter, map} from "rxjs/operators";
import {OUTPUT_FOLDER, SambalData, SAMBAL_INTERNAL} from "./constants";
import {writeFile, isExternalSource, getUriPath} from "./utils";
import {addJsonLdToDOM} from "./operators/addJsonLdToDOM";
import Logger from "./Logger";
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
    private log: Logger = new Logger({name: "Packager"});
    constructor(private obs$: Observable<SambalData>, private options: {prettyHtml?: boolean, bundle?: BundleFunction} = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
    }

    async deliver() {
        return new Promise((resolve, reject) => {
            this.obs$
            .pipe(filter(this.isValid))
            .pipe(this.bundleJsFiles())
            .pipe(addJsonLdToDOM())
            .pipe(this.outputHtml())
            .subscribe({
                next: (output: string) => this.log.info(`Wrote ${output}`),
                complete: async () => {
                    resolve();
                },
                error: (err) => {
                    this.log.error(err);
                    reject(err);
                }
            });
        });
    }

    private isValid(d: any): boolean {
        return Boolean(d[SAMBAL_INTERNAL] && d[SAMBAL_INTERNAL].html && (d[SAMBAL_INTERNAL].uri || d.url));
    }
    
    private bundleJsFiles() {
        return pipe<Observable<SambalData>, Observable<SambalData>>(
            mergeMap(async (data: SambalData) => {
                const bundleJobs = this.getBundlePromises(data[SAMBAL_INTERNAL].html);
                if (bundleJobs.length > 0) {
                    const dests = await Promise.all(bundleJobs.map(d => d.promise));
                    for (let i = 0; i < bundleJobs.length; i++) {
                        const node = bundleJobs[i].node;
                        const assets = dests[i];
                        this.addAssetsToDOM(assets, data[SAMBAL_INTERNAL].html, node);
                    }
                }
                return data;
            })
        );
    }

    private outputHtml() {
        return pipe<Observable<SambalData>, Observable<string>>(
            mergeMap(async (d) => {
                const sambalInternal = d[SAMBAL_INTERNAL];
                let html = sambalInternal.html.html();
                if (this.options.prettyHtml) {
                    html = prettier.format(html, {parser: "html"});
                }
                const uriPath = getUriPath(sambalInternal.base, sambalInternal.uri, d);
                return await this.write(path.join(OUTPUT_FOLDER, uriPath), html);
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
                self.log.info(`Bundling ${jsFile}`);
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