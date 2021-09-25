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

type RouteNode = {
    path: string,
    files: Set<string>,
    hasPage: boolean,
    children: Map<string, RouteNode>
}

type NodePair = {
    parent?: RouteNode,
    node: RouteNode
};

type PageProps = {
    route: string[],
    props: any
};

export default class Router {
    private root: RouteNode;
    private pageCache: Map<string, WebPage>;

    constructor(private uriResolver: UriResolver) {
        this.root = this.newRouteNode("/");
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
        if (this.pageCache.has(uri)) {
            return this.pageCache.get(uri);
        }

        const segments = uri.split("/");
        let currentNode = this.root;
        let routePath = [];
        let currentPagePropsRoute: string[];

        // i start at 1 because 0 is always empty string
        for (let i = 1; i < segments.length; i++) {
            if (currentNode.hasPage) {
                currentPagePropsRoute = [...routePath];
            }
            if (i === segments.length - 1) {
                for (const fileName of Array.from(currentNode.files)) {
                    const filePath = this.getFilePath(routePath, fileName);;
                    if (uri === inferUrl(filePath)) {
                        const pageProps = currentPagePropsRoute ?
                            await this.loadPageProps(currentPagePropsRoute) : {};
                        // don't cache if loading web page without page props
                        return await this.loadWebPage(filePath, pageProps);
                    }
                }
            }

            if (currentNode.children.has(segments[i])) {
                currentNode = currentNode.children.get(segments[i]);
                routePath.push(currentNode.path);
            } else {
                break;
            }
        }
        return null;
    }

    getPageIterator() {
        const rootNode = this.root;
        const self = this;
        const iterator = async function* generator() {
            const stack: NodePair[] = [{node: rootNode}];
            const pagePropsStack: PageProps[] = [];
            let current: NodePair;
            let prevNode: RouteNode;
            let currentPageProps: PageProps = {route: [], props: {}};
            let routePath = [];

            while (stack.length > 0) {
                current = stack.shift();
                if (current.parent !== prevNode) {
                    routePath.pop();
                }
                if (current.node.path !== "/") {
                    routePath.push(current.node.path);
                }
                const currentRoutePath = `/${routePath.join("/")}`;
                currentPageProps = self.getClosestPageProps(currentRoutePath, currentPageProps, pagePropsStack);
                if (current.node.hasPage) {
                    pagePropsStack.unshift(currentPageProps);
                    currentPageProps = {
                        route: [...routePath],
                        props: await self.loadPageProps(routePath)
                    };
                }
                for (const fileName of Array.from(current.node.files)) {
                    const filePath = self.getFilePath(routePath, fileName);
                    yield await self.loadWebPage(filePath, currentPageProps.props);
                }
                for(const childNode of Array.from(current.node.children.values())) {
                    stack.unshift({parent: current.node, node: childNode});
                }
                prevNode = current.node;
            }
        };
        return iterator();
    }

    private getFilePath(routePath: string[], fileName: string) {
        return `/${[PAGES_FOLDER, ...routePath].join("/")}/${fileName}`;
    }

    private getClosestPageProps(routePath: string, currentPageProps: PageProps, pagePropsStack: PageProps[]) {
        let closestPageProps = currentPageProps;
        let currentPagePropsRoute = `/${closestPageProps.route.join("/")}`;
        while (routePath.indexOf(currentPagePropsRoute) !== 0) {
            closestPageProps = pagePropsStack.shift();
            currentPagePropsRoute = `/${closestPageProps.route.join("/")}`;
        }
        return closestPageProps;
    }

    async collectRoutes() {
        const pages = searchFiles("pages/**/*")
                        .map(d => d.substring(6)); // remove pages/

        const routes: string[] = [];
        // const dataUris = this.data.map(d => normalizeJsonLdId(d));
        const nodeWithPagination: RouteNode[] = [];
        for (const page of pages) {
            await this.addPathToTree(page, routes, nodeWithPagination);
        }
    }

    private async addPathToTree(pagePath: string, routes: string[], nodeWithPagination: RouteNode[]) {
        const segments = pagePath.split("/");
        let currentNode = this.root;
        if (segments.length > 1) {
            for (let i = 0; i < segments.length - 1; i++) {
                const pathSegment = segments[i];
                if (currentNode.children.has(pathSegment)) {
                    currentNode = currentNode.children.get(pathSegment);
                } else {
                    const newNode = this.newRouteNode(pathSegment);
                    currentNode.children.set(pathSegment, newNode);
                    currentNode = newNode;
                }
            }
        }
        const fileName = segments[segments.length - 1];
        if (fileName === PAGE_FILE) {
            currentNode.hasPage = true;
        } else {
            currentNode.files.add(fileName);
            routes.push(pagePath);
        } 
    }

    private getWebPage(filePath: string, pageProps: any, mainEntity: any) {
        return {
            ...pageProps,
            [JSONLD_TYPE]: "WebPage",
            url: inferUrl(filePath),
            mainEntity: mainEntity
        };
    }

    private async loadWebPage(filePath: string, pageProps: any) {
        const mainEntity = await this.uriResolver.hydrateUri(filePath);
        const webpage: WebPage = this.getWebPage(filePath, pageProps, mainEntity);
        this.pageCache.set(filePath, webpage);
        return webpage;
    }

    private async loadPageProps(routePath: string[]) {
        const json = await loadLocalFile(`${PAGES_FOLDER}/${routePath.join("/")}/${PAGE_FILE}`);
        return await this.uriResolver.hydrate(json);
    }

    private newRouteNode(path: string): RouteNode {
        return {
            path: path,
            files: new Set<string>(),
            hasPage: false,
            children: new Map<string, RouteNode>()
        };
    }
}