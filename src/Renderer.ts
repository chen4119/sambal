import Graph from "./Graph";
import ReactSerializer from "./ui/ReactSerializer";
import WebpackListenerPlugin from "./WebpackListenerPlugin";
import { replaceScriptSrc } from "./helpers/html";
import {
    bundleSambalFile,
    watchSambalFile,
    bundleBrowserPackage,
    getDevServerBrowserCompiler
} from "./helpers/bundler";
import {
    getAbsFilePath,
    isObjectLiteral
} from "./helpers/util";
import {
    CACHE_FOLDER,
    OUTPUT_FOLDER,
    SAMBAL_ENTRY_FILE,
    Theme,
    OnBundleChanged,
    IHtmlSerializer
} from "./helpers/constant";
import { log } from "./helpers/log";

type UI = {
    renderPage: (props: {
        page: unknown,
        siteGraph: unknown,
        options?: unknown
    }) => Promise<unknown>,
    renderComponent: (props: {
        mainEntity: unknown,
        options?: unknown
    }) => Promise<unknown>,
    defaultOptions?: object,
    browserBundle?: {
        entry: unknown
    }
}

export default class Renderer {
    private serializer: IHtmlSerializer = new ReactSerializer();
    private internalRenderer: UI;
    private internalBrowserBundleEntry: object;
    private themeRenderer: UI;
    private themeFolder: string;
    private themeOptions: object;
    constructor(
        private entryFile: string,
        private theme: string | Theme,
        private publicPath: string,
        private siteGraph: Graph) {
        if (theme) {
            if (typeof(theme) === "string") {
                this.themeFolder = theme;
            } else if (isObjectLiteral(this.theme)) {
                this.themeFolder = theme.name;
                this.themeOptions = theme.options && isObjectLiteral(theme.options) ? theme.options : {};
            }
        }
    }

    async init() {
        if (this.entryFile) {
            log.info("Bundling sambal.entry.js...");
            await bundleSambalFile(this.entryFile, getAbsFilePath(`${CACHE_FOLDER}/output`));
            this.internalRenderer = require(getAbsFilePath(`${CACHE_FOLDER}/output/${SAMBAL_ENTRY_FILE}`));
            if (this.internalRenderer.browserBundle) {
                log.info("Bundling browser bundle...");
                this.internalBrowserBundleEntry = await bundleBrowserPackage(
                    this.internalRenderer.browserBundle,
                    getAbsFilePath(`${OUTPUT_FOLDER}/${this.publicPath}`)
                );
            }
        }
        await this.initTheme();
        if (!this.internalRenderer && !this.themeRenderer) {
            throw new Error("No html renderer available.  Implement sambal.entry.js or specify a theme in sambal.site.js");
        }
    }

    async initTheme() {
        if (this.themeFolder) {
            try {
                log.info(`Loading theme ${this.themeFolder}`);
                this.themeRenderer = require(getAbsFilePath(`${this.themeFolder}/dist/sambal.bundle.js`));
            } catch (e) {
                log.error("Error loading theme", e);
            }
        }
    }

    watchForEntryChange(onChange: OnBundleChanged) {
        if (this.entryFile) {
            return watchSambalFile(this.entryFile, (isError, entry) => {
                const module = require(getAbsFilePath(`${CACHE_FOLDER}/watch/${entry.main}`));
                this.internalRenderer = module;
                onChange(isError, entry);
            });
        } else {
            onChange(false, {});
            return null;
        }
    }

    watchForBrowserBundleChange(onChange: OnBundleChanged) {
        if (this.internalRenderer && this.internalRenderer.browserBundle) {
            const listener = new WebpackListenerPlugin((isError, entry) => {
                this.internalBrowserBundleEntry = entry;
                onChange(isError, entry);
            });
            return getDevServerBrowserCompiler(this.internalRenderer.browserBundle, listener);
        }
        return null;
    }

    async renderPage(page: unknown) {
        let renderResult;
        if (this.internalRenderer) {
            const defaultOptions = this.getDefaultOptions(this.internalRenderer);
            renderResult = await this.internalRenderer.renderPage({ 
                page: page,
                siteGraph: this.siteGraph,
                options: defaultOptions
            });
        }
        if (!renderResult && this.themeRenderer) {
            const defaultOptions = this.getDefaultOptions(this.themeRenderer);
            renderResult = await this.themeRenderer.renderPage({ 
                page: page,
                siteGraph: this.siteGraph,
                options: {
                    ...defaultOptions,
                    ...this.themeOptions
                }
            });
        }
        if (renderResult) {
            const html = this.serializer.toHtml(renderResult);
            return await this.postProcessHtml(html);
        }
        return null;
    }

    private async postProcessHtml(html: string) {
        if (this.internalBrowserBundleEntry) {
            return await replaceScriptSrc(html, (src) => {
                for (const entryName of Object.keys(this.internalBrowserBundleEntry)) {
                    if (src === entryName) {
                        return `${this.publicPath}/${this.internalBrowserBundleEntry[entryName]}`;
                    }
                }
                return src;
            });   
        }
        return html;
    }

    /*
    private async renderComponent(iri: string) {
        const mainEntity = await this.siteGraph.load(iri);
        let result;
        if (this.internalRenderer) {
            result = await this.internalRenderer.renderComponent({ 
                mainEntity
            });
        }
        if (!result && this.themeRenderer) {
            result = await this.themeRenderer.renderComponent({ 
                mainEntity
            });
        }
        return result;
    }*/

    private getDefaultOptions(renderer: UI) {
        if (renderer.defaultOptions && isObjectLiteral(renderer.defaultOptions)) {
            return renderer.defaultOptions;
        }
        return {};
    }
}