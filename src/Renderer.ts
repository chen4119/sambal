import shelljs from "shelljs";
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
    isObjectLiteral,
    getMimeType,
    readFileAsBuffer,
    getFileExt
} from "./helpers/util";
import {
    CACHE_FOLDER,
    OUTPUT_FOLDER,
    SAMBAL_ENTRY_FILE,
    THEME_PUBLIC_PATH,
    DEV_PUBLIC_PATH,
    Theme,
    OnBundleChanged,
    IHtmlSerializer
} from "./helpers/constant";
import { log } from "./helpers/log";

type UI = {
    renderPage: (props: {
        page: unknown,
        // siteGraph: unknown,
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
    private serializer: IHtmlSerializer;
    private internalRenderer: UI;
    private internalBrowserBundleEntry: object;
    private themeRenderer: UI;
    private themeBrowserBundleEntry: object;
    private themeFolder: string;
    private themeOptions: object;

    constructor(
        private entryFile: string,
        private theme: string | Theme) {
        this.serializer = new ReactSerializer();
        if (theme) {
            if (typeof(theme) === "string") {
                this.themeFolder = theme;
            } else if (isObjectLiteral(this.theme)) {
                this.themeFolder = theme.name;
                this.themeOptions = theme.options && isObjectLiteral(theme.options) ? theme.options : {};
            }
        }
    }

    async build(publicPath: string) {
        if (this.entryFile) {
            log.info("Bundling sambal.entry.js...");
            await bundleSambalFile(this.entryFile, getAbsFilePath(`${CACHE_FOLDER}/output`));
            this.internalRenderer = require(getAbsFilePath(`${CACHE_FOLDER}/output/${SAMBAL_ENTRY_FILE}`));
            if (this.internalRenderer.browserBundle) {
                log.info("Bundling browser bundle...");
                this.internalBrowserBundleEntry = await bundleBrowserPackage(
                    this.internalRenderer.browserBundle,
                    getAbsFilePath(`${OUTPUT_FOLDER}/${publicPath}`)
                );
            }
        }
        await this.initTheme();
        if (this.themeBrowserBundleEntry) {
            const outputDir = `${OUTPUT_FOLDER}/${publicPath}/${this.themeFolder}`;
            shelljs.mkdir("-p", outputDir);
            shelljs.cp("-R",
                getAbsFilePath(`${this.themeFolder}/dist/client/*`),
                getAbsFilePath(outputDir));
        }
        if (!this.internalRenderer && !this.themeRenderer) {
            throw new Error("No html renderer available.  Implement sambal.entry.js or specify a theme in sambal.site.js");
        }
    }

    async initTheme() {
        if (this.themeFolder) {
            try {
                log.info(`Loading theme ${this.themeFolder}`);
                const module = require(getAbsFilePath(`${this.themeFolder}/dist/index.js`));
                this.themeRenderer = module.entry;
                this.themeBrowserBundleEntry = module.browserBundle;
                return true;
            } catch (e) {
                log.error("Error loading theme", e);
            }
        }
        return false;
    }

    watchForEntryChange(onChange: OnBundleChanged) {
        if (this.entryFile) {
            return watchSambalFile(this.entryFile, (isError, entry) => {
                if (!isError) {
                    const module = require(getAbsFilePath(`${CACHE_FOLDER}/watch/${entry.main}`));
                    this.internalRenderer = module;
                    onChange(isError, entry);
                }
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

    async renderPage(page: unknown, publicPath?: string) {
        let renderResult;
        let clientBundle;
        let bundlePrefix;
        if (this.internalRenderer) {
            const defaultOptions = this.getDefaultOptions(this.internalRenderer);
            renderResult = await this.internalRenderer.renderPage({ 
                page: page,
                // siteGraph: this.siteGraph,
                options: defaultOptions
            });
            clientBundle = this.internalBrowserBundleEntry;
            bundlePrefix = publicPath ? publicPath : DEV_PUBLIC_PATH;
        }
        // if internalRenderer didn't render, try theme renderer, if available
        if (!renderResult && this.themeRenderer) {
            const defaultOptions = this.getDefaultOptions(this.themeRenderer);
            renderResult = await this.themeRenderer.renderPage({ 
                page: page,
                // siteGraph: this.siteGraph,
                options: {
                    ...defaultOptions,
                    ...this.themeOptions
                }
            });
            clientBundle = this.themeBrowserBundleEntry;
            bundlePrefix = publicPath ? `${publicPath}/${this.themeFolder}` : THEME_PUBLIC_PATH;
        }
        if (renderResult) {
            const html = typeof(renderResult) === "string" ? 
                renderResult :
                this.serializer.toHtml(renderResult);
            return await this.postProcessHtml(html, clientBundle, bundlePrefix);
        }
        return null;
    }

    private async postProcessHtml(html: string, bundle: object, prefix: string) {
        if (!bundle) {
            return html;
        }
        return await replaceScriptSrc(html, (src) => {
            for (const entryName of Object.keys(bundle)) {
                if (src === entryName) {
                    return `${prefix}/${bundle[entryName]}`;
                }
            }
            return src;
        });
    }

    async getThemeFile(filePath: string) {
        return {
            mime: getMimeType(getFileExt(filePath)),
            data: await readFileAsBuffer(getAbsFilePath(`${this.themeFolder}/dist/client/${filePath}`))
        }
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