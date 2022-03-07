import {
    getAbsFilePath,
    isObjectLiteral
} from "./helpers/util";
import {
    SAMBAL_ENTRY_FILE,
    Theme,
    WebPage,
    JS_FOLDER
} from "./helpers/constant";
import Bundler from "./Bundler";
import Html from "./Html";
import { log } from "./helpers/log";
import { template } from "./ui/template";

type UI = {
    renderPage: (props: {
        page: unknown,
        options?: unknown
    }) => Promise<string>,
    defaultOptions?: object
}

type Asset = {
    entry: string,
    onPages: Set<string>
}

type DevServerChangeHandler = (urls: string[]) => void;

export default class Renderer {
    private renderer: UI;
    private bundler: Bundler;
    private rootDir: string;
    private assets: Map<string, Asset>;
    // Map css source url() to dest url()
    private cssAssetMap: Map<string, string>;
    private devServerChangeHandler: DevServerChangeHandler;

    constructor(
        private baseUrl: string,
        private publicPath: string,
        private entryFile: string,
        private theme: string | Theme) {
        this.assets = new Map<string, Asset>();
        this.cssAssetMap = new Map<string, string>();
        this.rootDir = "."; // default to project root folder
    }

    async bundle() {
        let uiEntryFile = this.entryFile;
        let themeFolder;
        // Theme has precedence over entry file
        if (this.theme) {
            if (typeof(this.theme) === "string") {
                themeFolder = this.theme;
                uiEntryFile = getAbsFilePath(`${this.theme}/${SAMBAL_ENTRY_FILE}`);
            } else if (isObjectLiteral(this.theme)) {
                themeFolder = this.theme.name;
                uiEntryFile = getAbsFilePath(`${this.theme.name}/${SAMBAL_ENTRY_FILE}`);
            }
            this.rootDir = themeFolder;
        }
        log.info("Bundling sambal.entry.js...");
        const moduleEntry = await Bundler.bundleSambalFile(uiEntryFile);
        this.renderer = require(moduleEntry);
        if (!this.renderer) {
            throw new Error("No html renderer available.  Implement sambal.entry.js or specify a theme in sambal.site.js");
        }
    }

    async devInit(onChangeHandler: DevServerChangeHandler) {
        this.devServerChangeHandler = onChangeHandler;
        // bundler initialized only in dev mode
        this.bundler = new Bundler(this.onAssetChanged.bind(this));
        // Theme has precedence over entry file
        if (this.theme) {
            // bundle theme entry file, no need to watch
            await this.bundle();
        } else if (this.entryFile) {
            const moduleEntry = await this.bundler.watchSambalFile(this.entryFile);
            this.renderer = require(moduleEntry);
        }
        
        if (!this.renderer) {
            throw new Error("No html renderer available.  Implement sambal.entry.js or specify a theme in sambal.site.js");
        }
    }

    async stop() {
        this.bundler.stop();
    }

    private onAssetChanged(uri: string, entry: string) {
        if (this.assets.has(uri)) {
            this.assets.get(uri).entry = entry;
            this.devServerChangeHandler([...this.assets.get(uri).onPages.values()]);
        }
    }

    async renderPage(page: WebPage) {
        try {
            const options = {
                ...this.getDefaultOptions(this.renderer),
                ...isObjectLiteral(this.theme) ? (this.theme as Theme).options : {}
            };
            
            const html = await this.renderer.renderPage({ 
                page: page,
                options: options
            });

            if (html) {
                return await this.postProcessHtml(page, html);
            }
            return await this.renderErrorPage("Nothing rendered");
        } catch (e) {
            return await this.renderErrorPage(e);
        }
    }

    async renderErrorPage(e) {
        const renderError = (error) => {
            return template`
                <h1>${error.message}</h1>
                <p>${error.toString()}</p>
            `;
        };
        return await template`
            <html>
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
                    <meta http-equiv="X-UA-Compatible" content="ie=edge"/>
                    <base href="/">
                </head>
                <body>
                    ${Array.isArray(e) ?
                        e.map(error => renderError(error)) :
                        renderError(e)}
                </body>
            </html>
        `;
    }

    private async postProcessHtml(page: WebPage, html: string) {
        const htmlPage = new Html(html);
        for (const src of htmlPage.jsSources) {
            const entry = await this.bundleJs(src, page.url);
            htmlPage.replaceJsScriptSrc(src, this.relativeToRoot(entry));
        }
        for (const src of htmlPage.styleSheets) {
            const entry = await this.bundleCss(src, page.url);
            htmlPage.replaceStyleSheetSrc(src, this.relativeToRoot(entry));
        }
        await htmlPage.bundleStyles(this.bundleInlineStyle.bind(this));
        htmlPage.addSchemaJsonLd(page.mainEntity);
        htmlPage.addMetaTags(this.baseUrl, page);
        return htmlPage.serialize();
    }

    private relativeToRoot(path: string) {
        return path.startsWith("/") ? path : `/${path}`;
    }

    private async bundleInlineStyle(css: string) {
        return await Bundler.bundleStyle(this.cssAssetMap, css, this.publicPath);
    }

    private async bundleCss(cssPath: string, pageUrl: string) {
        const resolvedPath = this.resolvePath(cssPath);
        let entry;
        
        // If this.bundler inited, means dev mode
        if (this.bundler) {
            entry = await this.bundler.watchCssFile(this.cssAssetMap, resolvedPath, this.publicPath);
        } else {
            if (this.assets.has(resolvedPath)) {
                entry = this.assets.get(resolvedPath).entry;
            } else {
                entry = await Bundler.bundleCssFile(this.cssAssetMap, resolvedPath, this.publicPath);
                entry = entry.substring(this.publicPath.length);
            }
        }

        this.addToAssets(resolvedPath, entry, pageUrl);
        return entry;
    }

    private async bundleJs(jsPath: string, pageUrl: string) {
        const resolvedPath = this.resolvePath(jsPath);
        let entry;
        
        // If this.bundler inited, means dev mode
        if (this.bundler) {
            entry = await this.bundler.watchBrowserBundle(resolvedPath, this.getJsOutputPath());
        } else {
            if (this.assets.has(resolvedPath)) {
                entry = this.assets.get(resolvedPath).entry;
            } else {
                entry = await Bundler.bundleBrowserPackage(resolvedPath, this.getJsOutputPath());
                entry = entry.substring(this.publicPath.length);
            }
        }

        this.addToAssets(resolvedPath, entry, pageUrl);
        return entry;
    }

    private getJsOutputPath() {
        return `${this.publicPath}/${JS_FOLDER}`;
    }

    private resolvePath(filePath: string) {
        if (filePath.indexOf("node_modules/") >= 0) {
            return filePath;
        }
        return `${this.rootDir}/${filePath}`;
    }

    private addToAssets(assetUri: string, assetEntry: string, pageUrl: string) {
        if (this.assets.has(assetUri)) {
            const asset = this.assets.get(assetUri);
            asset.entry = assetEntry;
            asset.onPages.add(pageUrl);
        } else {
            this.assets.set(assetUri, {
                entry: assetEntry,
                onPages: new Set([pageUrl])
            });
        }
    }

    private getDefaultOptions(renderer: UI) {
        if (renderer.defaultOptions && isObjectLiteral(renderer.defaultOptions)) {
            return renderer.defaultOptions;
        }
        return {};
    }
}