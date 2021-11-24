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
    deepClone,
    getAbsFilePath,
    isObjectLiteral
} from "./helpers/util";
import {
    CACHE_FOLDER,
    SAMBAL_ENTRY_FILE,
    DEV_PUBLIC_PATH,
    Theme,
    OnBundleChanged,
    IHtmlSerializer,
    WebPage
} from "./helpers/constant";
import { serializeJsonLd, renderSocialMediaMetaTags } from "./helpers/seo";
import { log } from "./helpers/log";
import { template } from "./ui/template";
import { SCHEMA_CONTEXT } from "sambal-jsonld";
import { join } from "path";

type UI = {
    renderPage: (props: {
        page: unknown,
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
    private renderer: UI;
    private browserBundleEntry: object;

    constructor(
        private baseUrl: string,
        private publicPath: string,
        private entryFile: string,
        private theme: string | Theme) {
        this.serializer = new ReactSerializer();
    }

    async bundle() {
        let uiEntryFile = this.entryFile;
        let themeFolder;
        if (this.theme) {
            if (typeof(this.theme) === "string") {
                themeFolder = this.theme;
                uiEntryFile = getAbsFilePath(`${this.theme}/${SAMBAL_ENTRY_FILE}`);
            } else if (isObjectLiteral(this.theme)) {
                themeFolder = this.theme.name;
                uiEntryFile = getAbsFilePath(`${this.theme.name}/${SAMBAL_ENTRY_FILE}`);
            }
        }
        log.info("Bundling sambal.entry.js...");
        await bundleSambalFile(uiEntryFile, getAbsFilePath(`${CACHE_FOLDER}/output`));
        this.renderer = require(getAbsFilePath(`${CACHE_FOLDER}/output/${SAMBAL_ENTRY_FILE}`));
        if (this.renderer.browserBundle) {
            log.info("Bundling browser bundle...");
            const webpackEntry = deepClone(this.renderer.browserBundle)
            if (themeFolder) {
                this.updateThemeBrowserBundlePath(themeFolder, webpackEntry);
            }
            this.browserBundleEntry = await bundleBrowserPackage(
                webpackEntry,
                getAbsFilePath(this.publicPath)
            );
        }
        if (!this.renderer) {
            throw new Error("No html renderer available.  Implement sambal.entry.js or specify a theme in sambal.site.js");
        }
    }

    private updateThemeBrowserBundlePath(themeFolder: string, bundle: any) {
        if (bundle && bundle.entry) {
            for (const key of Object.keys(bundle.entry)) {
                bundle.entry[key] = join(themeFolder, bundle.entry[key]);
            }
        }
    }

    async watchForEntryChange(onChange: OnBundleChanged) {
        if (this.entryFile) {
            return watchSambalFile(this.entryFile, (isError, entry) => {
                if (!isError) {
                    this.renderer = require(getAbsFilePath(`${CACHE_FOLDER}/watch/${entry.main}`));
                    onChange(isError, entry);
                }
            });
        } else if (this.theme){
            // bundle theme entry file
            await this.bundle();
        }
        onChange(false, null);
        return null;
    }

    // Only called if using project sambal.entry.js not theme
    watchForBrowserBundleChange(onChange: OnBundleChanged) {
        if (this.renderer && this.renderer.browserBundle) {
            // override public path to path used by dev server
            this.publicPath = DEV_PUBLIC_PATH;
            const listener = new WebpackListenerPlugin((isError, entry) => {
                this.browserBundleEntry = entry;
                onChange(isError, entry);
            });
            return getDevServerBrowserCompiler(this.renderer.browserBundle, listener);
        }
        return null;
    }

    async renderPage(page: WebPage) {
        try {
            let renderResult;
            const options = {
                ...this.getDefaultOptions(this.renderer),
                ...isObjectLiteral(this.theme) ? (this.theme as Theme).options : {}
            };
            
            renderResult = await this.renderer.renderPage({ 
                page: page,
                options: options
            });

            if (renderResult) {
                const html = typeof(renderResult) === "string" ? 
                    renderResult :
                    this.serializer.toHtml(renderResult);
                return await this.postProcessHtml(page, html, this.browserBundleEntry);
            }
            return await this.renderErrorPage("Nothing rendered");
        } catch (e) {
            return await this.renderErrorPage(e);
        }
    }

    async renderErrorPage(e) {
        return await template`
            <html>
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
                    <meta http-equiv="X-UA-Compatible" content="ie=edge"/>
                    <base href="/">
                </head>
                <body>
                    <h1>Error</h1>
                    ${e}
                </body>
            </html>
        `;
    }

    private async postProcessHtml(page: WebPage, html: string, bundle: object) {
        let hasJsonLd = false;
        let hasSocialMediaMeta = false;
        let updatedHtml = await replaceScriptSrc(html, (name, attribs) => {
            if (name === "script" && attribs.type === "application/ld+json") {
                hasJsonLd = true;
            } else if (name === "meta" && this.isSocialMediaMeta(attribs.name)) {
                hasSocialMediaMeta = true;
            }

            if (bundle && name === "script" && attribs.src) {
                let realSrc = attribs.src;
                for (const entryName of Object.keys(bundle)) {
                    if (attribs.src === entryName) {
                        realSrc = `${this.publicPath}/${bundle[entryName]}`;
                        break;
                    }
                }
                return {
                    ...attribs,
                    src: realSrc
                };
            }
            return attribs;
        });
        if (!hasSocialMediaMeta && page.mainEntity) {
            updatedHtml = await this.addSocialMediaMeta(updatedHtml, page);
        }
        if (!hasJsonLd && page.mainEntity) {
            updatedHtml = this.addJsonLdScript(updatedHtml, page.mainEntity);
        }
        return updatedHtml;
    }

    private isSocialMediaMeta(name: string) {
        return name && (name.startsWith("og:") || name.startsWith("twitter:"));
    }

    private async addSocialMediaMeta(html: string, page: WebPage) {
        const metaTags = await renderSocialMediaMetaTags(this.baseUrl, page);

        const index = html.indexOf("<head>");
        if (index >= 0) {
            return html.substring(0, index + 6) + metaTags + html.substring(index + 6);
        }
        return html;
    }

    private addJsonLdScript(html: string, mainEntity: any) {
        const jsonLdScript = `
        <script type="application/ld+json">
            ${serializeJsonLd({
                "@context": SCHEMA_CONTEXT,
                ...mainEntity
            })}
        </script>`;

        const index = html.indexOf("</head>");
        if (index >= 0) {
            return html.substring(0, index) + jsonLdScript + html.substring(index);
        }
        return html;
    }

    private getDefaultOptions(renderer: UI) {
        if (renderer.defaultOptions && isObjectLiteral(renderer.defaultOptions)) {
            return renderer.defaultOptions;
        }
        return {};
    }
}