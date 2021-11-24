import { JSONLD_TYPE } from "sambal-jsonld";
import {
    CACHE_FOLDER,
    PAGES_FOLDER,
    PAGE_FILE,
    WebPage
} from "./helpers/constant";
import { inferUrl, isSupportedFile, loadLocalFile, searchFiles } from "./helpers/data";
import { log } from "./helpers/log";
import UriResolver from "./UriResolver";
import chokidar, { FSWatcher } from "chokidar";

export default class Router {
    private pageCache: Map<string, WebPage>;
    private pagePaths: string[];
    private pageUrlToFileMap: Map<string, string>; // map url to file path
    private pagePropsSet: Set<string>;

    constructor(private uriResolver: UriResolver) {
        this.initFileSystemRouter();
        this.pageCache = new Map<string, WebPage>();
    }

    async watchForFileChange(onChange: (type: string, path: string) => void) {
        return new Promise<FSWatcher>((resolve, reject) => {
            const watcher = chokidar.watch(process.cwd());
            watcher.on("ready", () => {
                watcher.on("change", (path) => {
                    if (this.isUserContentFile(path)) {
                        log.info(`File changed: ${path}`);
                        this.pageCache.clear();
                        this.uriResolver.clearCache();
                        onChange("change", path);
                    }
                });
                resolve(watcher);
            });
        });
    }

    private isUserContentFile(path: string) {
        const relativePath = path.substring(process.cwd().length);
        if (relativePath.startsWith(`/${CACHE_FOLDER}`)) {
            return false; // ignore all changes in cache folder
        }
        return isSupportedFile(relativePath);
    }

    async getPage(uri: string) {
        if (!this.pageUrlToFileMap.has(uri)) {
            return null;
        }
        const filePath = this.pageUrlToFileMap.get(uri);
        if (this.pageCache.has(filePath)) {
            return this.pageCache.get(filePath);
        }
        return await this.loadWebPage(filePath);
    }

    getPageIterator() {
        const self = this;
        const iterator = async function* generator() {
            for (const filePath of self.pagePaths) {
                yield await self.loadWebPage(filePath);
            }
        };
        return iterator();
    }

    private async loadWebPage(filePath: string) {
        const pagePropPath = this.getClosestPagePropPath(
            filePath.substring(0, filePath.lastIndexOf("/"))
        );
        const pageProps = pagePropPath ? await this.loadPageProps(pagePropPath) : {};
        
        const mainEntity = await this.uriResolver.hydrateUri(filePath);
        const webpage: WebPage = {
            ...pageProps,
            [JSONLD_TYPE]: "WebPage",
            url: inferUrl(filePath),
            mainEntity: mainEntity
        };
        this.pageCache.set(filePath, webpage);
        return webpage;
    }

    private async loadPageProps(filePath: string) {
        const json = await loadLocalFile(filePath);
        return await this.uriResolver.hydrate(json);
    }

    private getClosestPagePropPath(routePath: string) {
        // normalize path
        if (routePath.endsWith("/")) {
            routePath = routePath.substring(0, routePath.length - 1);
        }
        const segments = routePath.split("/");
        let endIndex = segments.length;
        do {
            const filePath = `${segments.slice(0, endIndex).join("/")}/${PAGE_FILE}`;
            if (this.pagePropsSet.has(filePath)) {
                return filePath;
            }
            endIndex--;
        } while (endIndex > 0);
        
        return null;
    }

    private getPagePaths() {
        return searchFiles(["pages/**/!(_page.yml)"])
            .map(d => `/${d}`);
    }

    private getPagePropPaths() {
        return searchFiles(["pages/**/_page.yml"])
            .map(d => `/${d}`);
    }

    private initFileSystemRouter() {
        this.pagePaths = this.getPagePaths();
        this.pageUrlToFileMap = new Map<string, string>();
        for (const filePath of this.pagePaths) {
            const pageUrl = inferUrl(filePath);
            if (this.pageUrlToFileMap.has(pageUrl)) {
                throw new Error(`Duplicate url ${pageUrl}`);
            }
            this.pageUrlToFileMap.set(pageUrl, filePath);
        }
        this.pagePropsSet = new Set(this.getPagePropPaths());
    }
}