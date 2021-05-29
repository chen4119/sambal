import {
    JSONLD_TYPE,
    JSONLD_CONTEXT,
    SCHEMA_CONTEXT,
    JSONLD_ID,
    isJsonLdRef
} from "sambal-jsonld";
import {
    PAGES_FOLDER,
    ROUTES_FILE,
    PAGE_FILE,
    Collection,
    WebPage,
    FS_PROTO
} from "./helpers/constant";
import { normalizeJsonLdId, loadLocalFile } from "./helpers/data";
import { log } from "./helpers/log";
import UriResolver from "./UriResolver";
import mm from "micromatch";
import CollectionResolver from "./resolvers/CollectionResolver";

type RouteNode = {
    path: string,
    files: Set<string>,
    hasPage: boolean,
    children: Map<string, RouteNode>
}

export default class Router {
    private root: RouteNode;
    private routeMap: Map<string, WebPage>;
    private collectionRoutes: Map<string, string[]>;
    private collectionResolver: CollectionResolver;

    constructor(
        private pages: string[],
        private data: string[],
        private collections: Collection[],
        private uriResolver: UriResolver) {
        this.root = this.newRouteNode("/");
        this.routeMap = new Map<string, WebPage>();
        this.collectionRoutes = new Map<string, string[]>();
        // pages.sort();
        pages.forEach(d => this.addPathToTree(d));
        this.collectRoutes();
        this.collectionResolver = new CollectionResolver(collections, this.collectionRoutes, this);
        this.uriResolver.addResolver(
            {protocol: FS_PROTO, path: collections.map(c => c.uri)},
            this.collectionResolver
        );
    }

    async getPage(uri: string) {
        if (this.routeMap.has(uri)) {
            return this.routeMap.get(uri);
        }

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
                        return await this.loadWebPage(uri, pageProps);
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

    getPageIterator() {
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
                    log.debug(`Route: ${uri}`);
                    yield await self.loadWebPage(uri, pageProps);
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
        return iterator();
    }

    getJsonLdIterator(baseUrl: string) {
        const self = this;
        const iterator = async function* generator() {
            const localFiles = [...self.pages, ...self.data];
            for (const filePath of localFiles) {
                if (filePath.endsWith(PAGE_FILE) || filePath.endsWith(ROUTES_FILE)) {
                    continue;
                }
                
                const uri = normalizeJsonLdId(filePath);
                const jsonld = await self.uriResolver.resolveUri(uri);
                if (!isJsonLdRef(jsonld)) {
                    yield {
                        [JSONLD_ID]: uri,
                        [JSONLD_CONTEXT]: {
                            "@vocab": SCHEMA_CONTEXT,
                            "@base": baseUrl
                        },
                        ...jsonld
                    }
                }
            }
        };
        return iterator();
    }

    private async loadWebPage(uri: string, pageProps: any) {
        const mainEntity = await this.uriResolver.hydrateUri(uri);
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

    private collectRoutes() {
        const routes = [];
        this.flattenRoutes(this.root, "", routes);
        for (const collection of this.collections) {
            const matches = mm(routes, collection.match);
            this.collectionRoutes.set(collection.uri, matches);
        }
    }

    private flattenRoutes(node: RouteNode, prefix: string, routes: string[]) {
        const currentPrefix = node.path === "/" ? "" : `${prefix}${node.path}/`;
        for (const fileName of Array.from(node.files)) {
            routes.push(normalizeJsonLdId(`/${currentPrefix}${fileName}`));
        }
        for (const segment of Array.from(node.children.keys())) {
            const childNode = node.children.get(segment);
            this.flattenRoutes(childNode, currentPrefix, routes);
        }
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