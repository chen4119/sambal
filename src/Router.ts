import Graph from "./Graph";
import CollectionBuilder from "./CollectionBuilder";
import { searchLocalFiles, normalizeRelativePath } from "./helpers/data";
import { JSONLD_ID, JSONLD_TYPE, isJsonLdRef } from "sambal-jsonld";
import { log } from "./helpers/log";
import { PartitionKey, WebPage } from "./helpers/constant";

type EntityType = string | unknown | Promise<unknown>;
type CallbackResult = string | {path: string, options: RouteOption};
type getRouteFn = (mainEntity: unknown, partitionKey?: unknown) => CallbackResult;
type RouteOption = {
    canonical?: boolean,
    page?: EntityType
}

type Route = {
    pageType: string,
    mainEntity: EntityType,
    options?: RouteOption
}

type RouteGenerator = {
    type: string,
    args: any,
    getRoute: getRouteFn
}

/*
type RouteNode = {
    path: string,
    children: Map<string, RouteNode>
}*/

export const Page = {
    About: "AboutPage",
    Collection: "CollectionPage",
    Contact: "ContactPage",
    // Error: "sambal:error",
    // FAQ: "schema:faqpage",
    Item: "ItemPage",
    Landing: "sambal:Landing",
    NotFound: "sambal:NotFound",
    Profile: "ProfilePage"
    // SearchResults: "schema:searchresultspage"
};

export default class Router {
    private routeMap: Map<string, Route>;
    private routeGenerators: RouteGenerator[];
    constructor(private graph: Graph, private collections: CollectionBuilder) {
        this.routeMap = new Map<string, Route>();
        this.routeGenerators = [];
    }
    
    get instance() {
        const setRoute = (path: string, pageType: string, mainEntity: EntityType, options?: RouteOption) => {
            this.setRouteHelper(path, pageType, mainEntity, options);
            return closure;
        };

        const setGenerator = (type: string, args: any, getRoute: getRouteFn) => {
            this.routeGenerators.push({
                type,
                args,
                getRoute
            });
            return closure;
        };

        const closure = {
            aboutPage: (path: string, mainEntity: EntityType, options?: RouteOption) => { 
                return setRoute(path, Page.About, mainEntity, options);
            },
            collectionPage: (path: string, mainEntity: EntityType, options?: RouteOption) => { 
                return setRoute(path, Page.Collection, mainEntity, options);
            },
            contactPage: (path: string, mainEntity: EntityType, options?: RouteOption) => { 
                return setRoute(path, Page.Contact, mainEntity, options);
            },
            itemPage: (path: string, mainEntity: EntityType, options?: RouteOption) => { 
                return setRoute(path, Page.Item, mainEntity, options);
            },
            landingPage: (mainEntity: EntityType, options?: RouteOption) => { 
                return setRoute("/", Page.Landing, mainEntity, options);
            },
            notFound: (path: string) => {
                return setRoute(path, Page.NotFound, null, null);
            },
            profilePage: (path: string, mainEntity: EntityType, options?: RouteOption) => { 
                return setRoute(path, Page.Profile, mainEntity, options);
            },
            iterateItems: (src: string | string[], getRoute: getRouteFn) => {
                return setGenerator("iterateItems", src, getRoute);
            },
            paginateCollection(collectionIRI: string, pageSize: number, getRoute: getRouteFn) {
                return setGenerator("paginateCollection", {
                    collectionIRI,
                    pageSize
                }, getRoute);
            },
            paginatePartition(collectionIRI: string, partitionKey: PartitionKey, pageSize: number, getRoute: getRouteFn) {
                return setGenerator("paginatePartition", {
                    collectionIRI,
                    partitionKey,
                    pageSize
                }, getRoute);
            }
        };
        return closure;
    }

    async getRoutes() {
        // load user defined routes before running generators to avoid duplicate loading
        for (const path of Array.from(this.routeMap.keys())) {
            const route = this.routeMap.get(path);
            log.debug(`Route: ${path}`);
            route.mainEntity = await this.loadEntity(route.mainEntity);
            if (route.options.page) {
                route.options.page = await this.loadEntity(route.options.page);
            }
        }
        for (const generator of this.routeGenerators) {
            if (generator.type === "paginateCollection") {
                await this.paginateCollection(generator.args.collectionIRI, generator.args.pageSize, generator.getRoute);
            } else if (generator.type === "iterateItems") {
                await this.iterateItems(generator.args, generator.getRoute);
            }
        }
        const pages = await this.createRoutePages();
        await this.verifySiteNavigation();
        return pages;

        // const root = this.createRouteHierarchy();
        // const flatten = toJsonLdGraph([root], SCHEMA_CONTEXT);
        // await this.graph.load(flatten);
        // return root;
    }

    private async verifySiteNavigation() {
        for (const nav of this.graph.siteNavElements) {
            if (isJsonLdRef(nav.mainEntity)) {
                const iri = nav.mainEntity[JSONLD_ID];
                const jsonld = await this.loadEntity(iri);
                delete nav.mainEntity;
                nav.name = jsonld.name ? jsonld.name : jsonld.headline;
                nav.url = jsonld.mainEntityOfPage;
                if (!nav.url) {
                    throw new Error(`Invalid site nav link: ${iri} does not have a url`);
                }
            }
        }
    }

    private async loadEntity(entity: EntityType) {
        return await this.graph.load(await entity); // entity maybe a promise
    }

    private setRouteHelper(path: string, pageType: string, mainEntity: EntityType, options?: RouteOption) {
        this.routeMap.set(normalizeRelativePath(path), {
            pageType: pageType,
            mainEntity: mainEntity,
            options: options ? options : {}
        });
    }

    private async getRouteHelper(getRoute: getRouteFn, pageType: string, mainEntity: any, partitionKey?: object) {
        const route = getRoute(mainEntity, partitionKey);
        if (typeof(route) === "string") {
            log.debug(`Route: ${route}`);
            this.setRouteHelper(route, pageType, mainEntity);
        } else {
            log.debug(`Route: ${route.path}`);
            if (route.options.page) {
                route.options.page = await this.loadEntity(route.options.page);
            }
            this.setRouteHelper(route.path, pageType, mainEntity, route.options);
        }
    }

    private async iterateItems(src: string | string[], getRoute: getRouteFn) {
        const matches = searchLocalFiles(src);
        for (const srcPath of matches) {
            const data = await this.graph.load(srcPath);
            await this.getRouteHelper(getRoute, Page.Item, data);
        }
    }

    private async paginateCollection(collectionIRI: string, pageSize: number, getRoute: getRouteFn) {
        const partitions = await this.collections.getCollectionPages(collectionIRI, pageSize);
        for (const partition of partitions) {
            for (const page of partition.pages) {
                await this.getRouteHelper(getRoute, Page.Collection, page, partition.key);
            }
        }
    }

    private async createRoutePages() {
        const pages: WebPage[] = [];
        const paths: string[] = Array.from(this.routeMap.keys());

        for (const path of paths) {
            const pageJsonLd = this.getPageJsonLd(path, this.routeMap.get(path));
            await this.graph.load(pageJsonLd);
            // pageJsonLd.mainEntity.mainEntityOfPage = pageJsonLd.url;
            pages.push(pageJsonLd);
        }

        // set mainEntityOfPage url
        for (const page of pages) {
            const incomingLinks = this.graph.getIncomingLinks(page.mainEntity[JSONLD_ID]);
            const mainEntityLinks = incomingLinks.filter(l => l.predicate === "schema:mainEntity");
            if (mainEntityLinks.length === 1) {
                page.mainEntity.mainEntityOfPage = page.url;
            } else {
                log.debug("Multiple mainEntity links found %s", mainEntityLinks);
                for (const link of mainEntityLinks) {
                    const route = this.routeMap.get(link.subject);
                    if (route.options.canonical) {
                        page.mainEntity.mainEntityOfPage = link.subject;
                    }
                }
                if (!page.mainEntity.mainEntityOfPage) {
                    throw new Error(`${page.mainEntity[JSONLD_ID]} is the mainEntity of multiple pages ${mainEntityLinks.map(l => l.subject)}.  Specify which one is canonical`);
                }
            }
        }
        return pages;
    }

    private getPageJsonLd(path: string, route: Route) {
        const page: WebPage = {
            ...route.options.page ? route.options.page as object : {},
            [JSONLD_ID]: path,
            [JSONLD_TYPE]: route.pageType,
            url: path,
            mainEntity: route.mainEntity,
        };
        
        return page;
    }

    /*
    private createRouteHierarchy() {
        const paths: string[] = Array.from(this.routeMap.keys());
        paths.sort();
        const root = {
            path: "/",
            children: new Map<string, RouteNode>()
        };
        for (const path of paths) {
            if (path !== "/") {
                this.addPathToTree(root, path);
            }
        }
        return this.recurseHierarchy("", root);
    }

    private recurseHierarchy(prefix: string, currentNode: RouteNode) {
        const path = prefix ? `${prefix === "/" ? prefix : `${prefix}/`}${currentNode.path}` : "/";
        let pageJsonLd;
        if (this.routeMap.has(path)) {
            pageJsonLd = this.getPageJsonLd(path, this.routeMap.get(path));
        }
        let hasPart = [];
        for(const childNode of Array.from(currentNode.children.values())) {
            const childParts = this.recurseHierarchy(path, childNode);
            if (Array.isArray(childParts)) {
                hasPart = [...hasPart, ...childParts];
            } else {
                hasPart.push(childParts);
            }
            hasPart.forEach(d => d.isPartOf = path);
        }
        if (pageJsonLd) {
            pageJsonLd.hasPart = hasPart;
            return pageJsonLd;
        }
        return hasPart;
    }

    private addPathToTree(root: RouteNode, path: string) {
        const segments = path.split("/");
        let currentNode = root;
        // 0 will be empty string
        for (let i = 1; i < segments.length; i++) {
            const pathSegment = segments[i];
            if (currentNode.children.has(pathSegment)) {
                currentNode = currentNode.children.get(pathSegment);
            } else {
                const newNode = {
                    path: pathSegment,
                    children: new Map<string, RouteNode>()
                };
                currentNode.children.set(pathSegment, newNode);
                currentNode = newNode;
            }
        }
    }*/

}