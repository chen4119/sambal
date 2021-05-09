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

export const Page = {
    // About: "AboutPage",
    // Collection: "CollectionPage",
    // Contact: "ContactPage",
    // Item: "ItemPage",
    // Landing: "sambal:Landing",
    NotFound: "sambal:NotFound",
    WebPage: "WebPage"
    // Profile: "ProfilePage"
};

export default class Router {
    private routeMap: Map<string, Route>;
    private entities: EntityType[];
    private routeGenerators: RouteGenerator[];
    constructor(private baseUrl: string, private graph: Graph, private collections: CollectionBuilder) {
        this.routeMap = new Map<string, Route>();
        this.routeGenerators = [];
        this.entities = [];
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
            page: (path: string, mainEntity: EntityType, options?: RouteOption) => { 
                return setRoute(path, Page.WebPage, mainEntity, options);
            },
            jsonLd: (mainEntity: EntityType) => { 
                this.entities.push(mainEntity);
            },
            notFoundPage: (path: string) => {
                return setRoute(path, Page.NotFound, null, null);
            },
            multiplePages: (src: string | string[], getRoute: getRouteFn) => {
                return setGenerator("multiplePages", src, getRoute);
            },
            multipleJsonLds: (src: string | string[]) => {
                return setGenerator("multipleJsonLds", src, null);
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
                await this.paginateCollection(
                    generator.args.collectionIRI,
                    generator.args.pageSize,
                    generator.getRoute
                );
            } else if (generator.type === "paginatePartition") {
                await this.paginatePartition(
                    generator.args.collectionIRI,
                    generator.args.partitionKey,
                    generator.args.pageSize,
                    generator.getRoute
                );
            } else if (generator.type === "multiplePages") {
                await this.multiplePages(generator.args, generator.getRoute);
            } else if (generator.type === "multipleJsonLds") {
                await this.multipleJsonLds(generator.args);
            }
        }
        for (const entity of this.entities) {
            await this.loadEntity(entity);
        }
        const pages = await this.createRoutePages();
        await this.verifySiteNavigation();
        return pages;
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
                    log.warn(`Invalid site nav: ${iri} does not have a url`);
                    // throw new Error(`Invalid site nav link: ${iri} does not have a url`);
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

    private async multiplePages(src: string | string[], getRoute: getRouteFn) {
        const matches = searchLocalFiles(src);
        for (const srcPath of matches) {
            const data = await this.graph.load(srcPath);
            await this.getRouteHelper(getRoute, Page.WebPage, data);
        }
    }

    private async multipleJsonLds(src: string | string[]) {
        const matches = searchLocalFiles(src);
        for (const srcPath of matches) {
            this.entities.push(srcPath);
        }
    }

    private async paginateCollection(collectionIRI: string, pageSize: number, getRoute: getRouteFn) {
        const partitions = await this.collections.getCollectionPages(collectionIRI, pageSize);
        for (const partition of partitions) {
            for (const page of partition.pages) {
                await this.getRouteHelper(getRoute, Page.WebPage, page, partition.key);
            }
        }
    }

    private async paginatePartition(collectionIRI: string, partitionKey: PartitionKey, pageSize: number, getRoute: getRouteFn) {
        const partition = await this.collections.getPartitionPages(collectionIRI, partitionKey, pageSize);
        if (partition) {
            for (const page of partition.pages) {
                await this.getRouteHelper(getRoute, Page.WebPage, page, partition.key);
            }
        }
    }

    private async createRoutePages() {
        const pages: WebPage[] = [];
        const paths: string[] = Array.from(this.routeMap.keys());

        for (const path of paths) {
            const pageJsonLd = this.getPageJsonLd(path, this.routeMap.get(path));
            await this.graph.load(pageJsonLd);
            pages.push(pageJsonLd);
        }

        // set mainEntityOfPage url
        for (const page of pages) {
            page.mainEntity.mainEntityOfPage = page.url;

            const incomingLinks = this.graph.getIncomingLinks(page.mainEntity[JSONLD_ID]);
            const mainEntityLinks = incomingLinks.filter(l => l.predicate === "schema:mainEntity");
            if (mainEntityLinks.length > 1) {
                log.debug("Multiple mainEntity links found %s", mainEntityLinks.map(l => l.subject));
                for (const link of mainEntityLinks) {
                    const relativePath = link.subject.substring(this.baseUrl.length);
                    const route = this.routeMap.get(relativePath);
                    if (route && route.options.canonical) {
                        page.mainEntity.mainEntityOfPage = relativePath;
                    }
                }
                if (!page.mainEntity.mainEntityOfPage) {
                    log.warn(`${page.mainEntity[JSONLD_ID]} is the mainEntity of multiple pages.  Specify which one is canonical`);
                    // throw new Error(`${page.mainEntity[JSONLD_ID]} is the mainEntity of multiple pages ${mainEntityLinks.map(l => l.subject)}.  Specify which one is canonical`);
                }
            }
        }
        return pages;
    }

    private getPageJsonLd(path: string, route: Route) {
        const page: WebPage = {
            ...route.options.page ? route.options.page as object : {},
            [JSONLD_ID]: `${this.baseUrl}${path}`,
            [JSONLD_TYPE]: route.pageType,
            url: path,
            mainEntity: route.mainEntity,
        };
        
        return page;
    }

}