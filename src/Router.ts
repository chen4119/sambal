import {
    JSONLD_TYPE,
    JSONLD_CONTEXT,
    SCHEMA_CONTEXT,
    JSONLD_ID,
    isJsonLdRef
} from "sambal-jsonld";
import {
    PAGES_FOLDER,
    MOUNT_FILE,
    PAGE_FILE,
    Collection,
    WebPage,
    FS_PROTO,
    DATA_FOLDER,
    EntityUri,
    EntityType
} from "./helpers/constant";
import { normalizeJsonLdId, loadLocalFile } from "./helpers/data";
import { log } from "./helpers/log";
import UriResolver from "./UriResolver";
import mm from "micromatch";
import CollectionResolver from "./resolvers/CollectionResolver";
import chokidar, { FSWatcher } from "chokidar";
import { getAbsFilePath, isJsDate } from "./helpers/util";

type RouteNode = {
    path: string,
    files: Set<string>,
    hasPage: boolean,
    mount: Map<string, any>,
    paginateCollection?: any,
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

const DEFAULT_PAGE_SIZE = 100;

export default class Router {
    private root: RouteNode;
    private routeMap: Map<string, WebPage>;
    private collectionResolver: CollectionResolver;

    constructor(
        private pages: string[],
        private data: string[],
        private uriResolver: UriResolver) {
        this.root = this.newRouteNode("/");
        this.routeMap = new Map<string, WebPage>();
    }

    async watchForFileChange(onChange: (type: string, path: string) => void) {
        return new Promise<FSWatcher>((resolve, reject) => {
            const watcher = chokidar.watch([getAbsFilePath(PAGES_FOLDER), getAbsFilePath(DATA_FOLDER)]);
            watcher.on("ready", () => {
                /*
                watcher.on("add", (path) => {
                    log.info(`New file: ${path}`);
                    // console.log(stats);
                });*/
                watcher.on("change", (path) => {
                    log.info(`File changed: ${path}`);
                    this.routeMap.clear();
                    this.uriResolver.clearCache();
                    onChange("change", path);
                });
                resolve(watcher);
            });
        });
    }

    async getPage(uri: string, withPageProps: boolean = true) {
        if (this.routeMap.has(uri)) {
            return this.routeMap.get(uri);
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
            if (currentNode.mount.size > 0) {
                let mountPath = "/";
                if (routePath.length > 0) {
                    mountPath = uri.substring(`/${routePath.join("/")}/`.length);
                }
                if (currentNode.mount.has(mountPath)) {
                    const pageProps = (withPageProps && currentPagePropsRoute) ?
                        await this.loadPageProps(currentPagePropsRoute) : {};
                    return this.getWebPage(uri, uri, pageProps, currentNode.mount.get(mountPath));
                }
            }
            if (i === segments.length - 1) {
                for (const fileName of Array.from(currentNode.files)) {
                    const testUri = normalizeJsonLdId(`${routePath.join("/")}/${fileName}`);
                    if (uri === testUri) {
                        const pageProps = (withPageProps && currentPagePropsRoute) ?
                            await this.loadPageProps(currentPagePropsRoute) : {};
                        // don't cache if loading web page without page props
                        return await this.loadWebPage(uri, pageProps, withPageProps);
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
                    const uri = normalizeJsonLdId(`${routePath.join("/")}/${fileName}`);
                    yield await self.loadWebPage(uri, currentPageProps.props);
                }
                for (const mountPath of Array.from(current.node.mount.keys())) {
                    const uri = `/${routePath.join("/")}/${mountPath}`;
                    yield self.getWebPage(uri, uri, currentPageProps.props, current.node.mount.get(mountPath));
                }
                for(const childNode of Array.from(current.node.children.values())) {
                    stack.unshift({parent: current.node, node: childNode});
                }
                prevNode = current.node;
            }
        };
        return iterator();
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

    getJsonLdIterator(baseUrl: string) {
        const self = this;
        const iterator = async function* generator() {
            const localFiles = [...self.pages, ...self.data];
            for (const filePath of localFiles) {
                if (filePath.endsWith(PAGE_FILE) || filePath.endsWith(MOUNT_FILE)) {
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

    private getWebPage(url: string, canonicalUrl: string, pageProps: any, mainEntity: any) {
        return {
            ...pageProps,
            [JSONLD_TYPE]: "WebPage",
            url: url,
            mainEntity: mainEntity,
            mainEntityOfPage: canonicalUrl
        };
    }

    private async loadWebPage(uri: string, pageProps: any, isCache: boolean = true) {
        const mainEntity = await this.uriResolver.hydrateUri(uri);
        const webpage: WebPage = this.getWebPage(uri, mainEntity[JSONLD_ID], pageProps, mainEntity);
        if (isCache) {
            this.routeMap.set(uri, webpage);
        }
        return webpage;
    }

    private async loadPageProps(routePath: string[]) {
        const json = await loadLocalFile(`${PAGES_FOLDER}/${routePath.join("/")}/${PAGE_FILE}`);
        return await this.uriResolver.hydrate(json);
    }

    async collectRoutes(collections: Collection[]) {
        const routes: string[] = [];
        const dataUris = this.data.map(d => normalizeJsonLdId(d));
        const nodeWithPagination: RouteNode[] = [];
        for (const page of this.pages) {
            await this.addPathToTree(page, routes, nodeWithPagination);
        }

        const collectionRoutes = new Map<string, EntityUri[]>();
        for (const collection of collections) {
            let entityUris: EntityUri[] = [];
            const routeMatches = mm(routes, collection.match);
            entityUris = entityUris.concat(routeMatches.map(m => ({type: EntityType.Page, path: m})));

            const dataMatches = mm(dataUris, collection.match);
            entityUris = entityUris.concat(dataMatches.map(m => ({type: EntityType.Data, path: m})));
            collectionRoutes.set(collection.uri, entityUris);
        }
        this.collectionResolver = new CollectionResolver(collections, collectionRoutes, this.uriResolver, this);
        this.uriResolver.addResolver(
            {protocol: FS_PROTO, path: collections.map(c => c.uri)},
            this.collectionResolver
        );

        for (const node of nodeWithPagination) {
            await this.paginateCollection(node);
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
        } else if (fileName === MOUNT_FILE) {
            const data = await loadLocalFile(`${PAGES_FOLDER}/${pagePath}`);
            if (data.forEach) {
                const pathPrefix = segments.length > 1 ? segments.slice(0, segments.length - 1).join("/") : "";
                await this.iterateMainEntities(currentNode, pathPrefix, routes, data.forEach);
            }
            if (data.paginateCollection) {
                currentNode.paginateCollection = data.paginateCollection;
                nodeWithPagination.push(currentNode);
            }
        } else {
            currentNode.files.add(fileName);
            routes.push(normalizeJsonLdId(pagePath));
        }
    }

    private async iterateMainEntities(node: RouteNode, pathPrefix: string, routes: string[], iterator) {
        if (iterator.uri && iterator.path) {
            const entityList = await this.uriResolver.hydrateUri(iterator.uri);
            if (Array.isArray(entityList)) {
                for (const mainEntity of entityList) {
                    const uri = this.interpolateUri(iterator.path, mainEntity);
                    const entityUri = normalizeJsonLdId(`${pathPrefix}/${uri}`);
                    if (node.mount.has(uri)) {
                        log.error(`Duplicate url ${uri}`);
                    }
                    if (!mainEntity[JSONLD_ID]) {
                        mainEntity[JSONLD_ID] = entityUri;
                    }
                    node.mount.set(uri, mainEntity);
                    routes.push(entityUri);
                }
            }
        } else {
            log.error(`Invalid forEach config.  No uri or path %O`, iterator);
        }
    }

    private async paginateCollection(node: RouteNode) {
        const paginate = node.paginateCollection;
        if (Array.isArray(paginate)) {
            for (const child of paginate) {
                await this.paginateCollection(child);
            }
        } else if (paginate.uri && paginate.path) {
            const pageSize = Number.isInteger(paginate.pageSize) ? paginate.pageSize : DEFAULT_PAGE_SIZE;
            const partitions = await this.collectionResolver.getCollectionPages(this.uriResolver.parseUri(paginate.uri), pageSize);
            for (const partition of partitions) {
                for (let i = 0; i < partition.pages.length; i++) {
                    const variables = {
                        ...partition.key,
                        pageNum: i + 1
                    };
                    try {
                        const uri = this.interpolateUri(paginate.path, variables);
                        if (node.mount.has(uri)) {
                            log.error(`Duplicate url ${uri}`);
                        }
                        node.mount.set(uri, partition.pages[i]);
                    } catch (e) {
                        log.error(`No value for ${e.message}. Possible variables %O`, variables);
                    }

                }
            }
        } else {
            log.error(`Invalid paginateCollection config.  No uri or path %O`, paginate);
        }
    }

    private interpolateUri(template: string, variables: object) {
        const segments = template.split("/");
        let route = [];
        for (const segment of segments) {
            // ignore if empty string
            if (segment) {
                route.push(segment.startsWith(":") ?
                    this.substituteVariable(segment, variables) : segment);
            }
        }
        return route.join("/");
    }

    private substituteVariable(segment: string, variables: object) {
        // remove first character ":"
        const varName = segment.substring(1);
        const varValue = variables[varName];
        if (typeof(varValue) === "string" || typeof(varValue) === "number") {
            return variables[varName];
        }
        throw new Error(segment);
    }

    private newRouteNode(path: string): RouteNode {
        return {
            path: path,
            files: new Set<string>(),
            hasPage: false,
            mount: new Map<string, any>(),
            children: new Map<string, RouteNode>()
        };
    }
}