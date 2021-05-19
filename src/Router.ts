import Graph from "./Graph";
import { JSONLD_TYPE, isJsonLdRef, JSONLD_ID } from "sambal-jsonld";
import { PAGES_FOLDER, ROUTES_FILE, PAGE_FILE, WebPage } from "./helpers/constant";
import { normalizeJsonLdId, loadLocalFile } from "./helpers/data";
import { log } from "./helpers/log";

type RouteNode = {
    path: string,
    files: Set<string>,
    hasPage: boolean,
    children: Map<string, RouteNode>
}

export default class Router {
    private root: RouteNode;
    private routeMap: Map<string, WebPage>;

    constructor(private pages: string[], private data: string[], private graph: Graph) {
        this.root = this.newRouteNode("/");
        this.routeMap = new Map<string, WebPage>();
        pages.sort();
        pages.forEach(d => this.addPathToTree(d));
    }

    async getPage(uri: string) {
        const segments = uri.split("/");
        let currentNode = this.root;
        let routePath = [];
        let pageProps = {};
        // i start at 1 because 0 is always empty string
        for (let i = 1; i < segments.length; i++) {
            if (currentNode.hasPage) {
                pageProps = await this.loadPageProps(routePath);
            }
            if (i === segments.length - 1) {
                for (const fileName of Array.from(currentNode.files)) {
                    const testUri = normalizeJsonLdId(`${routePath.join("/")}/${fileName}`);
                    if (uri === testUri) {
                        return await this.loadMainEntity(uri, pageProps);
                    }
                }
                return null;
            }

            if (currentNode.children.has(segments[i])) {
                currentNode = currentNode.children.get(segments[i]);
                routePath.push(currentNode.path);
            } else {
                return null;
            }
        }
        return null;
    }

    getRouteIterator() {
        const rootNode = this.root;
        const self = this;
        const iterator = async function* generator() {
            const stack: RouteNode[] = [rootNode];
            const pageProps: any[] = [];
            let currentNode: RouteNode;
            let currentPageProps = {};
            let routePath = [];

            while (stack.length > 0) {
                currentNode = stack.shift();
                if (currentNode.path !== "/") {
                    routePath.push(currentNode.path);
                }
                if (currentNode.hasPage) {
                    pageProps.unshift(currentPageProps);
                    currentPageProps = self.loadPageProps(routePath);
                }
                for (const fileName of Array.from(currentNode.files)) {
                    const uri = normalizeJsonLdId(`${routePath.join("/")}/${fileName}`);
                    yield await self.loadMainEntity(uri, pageProps);
                }
                for(const childNode of Array.from(currentNode.children.values())) {
                    stack.unshift(childNode);
                }
                routePath.pop();
                if (currentNode.hasPage) {
                    currentPageProps = pageProps.shift();
                }
            }
        };
        return iterator;
    }

    private async loadMainEntity(uri: string, pageProps: any) {
        if (this.routeMap.has(uri)) {
            return this.routeMap.get(uri);
        }

        const mainEntity = await this.graph.load(uri);
        const webpage: WebPage = {
            ...pageProps,
            [JSONLD_TYPE]: "WebPage",
            url: mainEntity[JSONLD_ID],
            mainEntity: mainEntity
        };
        this.routeMap.set(uri, webpage);
        return webpage;
    }

    private async loadPageProps(routePath: string[]) {
        return await loadLocalFile(`${PAGES_FOLDER}/${routePath.join("/")}/${PAGE_FILE}`);
    }

    private addPathToTree(pagePath: string) {
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
        } else if (fileName === ROUTES_FILE) {
            
        } else {
            currentNode.files.add(fileName);
        }
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