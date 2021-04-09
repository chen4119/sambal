import Router from "../src/Router";
import CollectionBuilder from "../src/CollectionBuilder";
import Graph from "../src/Graph";
import Media from "../src/Media";
import Links from "../src/Links";
import { Collection } from "../src/helpers/constant";

describe("SambalCollection", () => {
    const baseUrl = "https://example.com";
    let router: Router;
    let graph: Graph;
    let links: Links;
    let collectionBuilder: CollectionBuilder;

    const collections: Collection[] = [
        {
            "@id": "collections/year",
            "@type": "SiteNavigationElement",
            src: ["blogs/**/*"],
            sortBy: {
                prop: "dateModified",
                order: "asc"
            }
        }
    ];

    beforeEach(async () => {
        links = new Links();
        collectionBuilder = new CollectionBuilder(collections);
        graph = new Graph(baseUrl, new Media([]), links, collectionBuilder);
        router = new Router(graph, collectionBuilder);

        router.instance
        .landingPage("johnsmith", {page: {
            hasPart: {"@id": "collections/year"}
        }})
        .itemPage("/blog1", "blogs/blog1")
        .itemPage("/canonical/blog1", "blogs/blog1", { canonical: true })
        .itemPage("/blog2", "blogs/blog2");
    });

    it('getRoutes', async () => {
        const pages = await router.getRoutes();
        expect(pages.length).toBe(4);
    });

    it('landing page has sitenav', async () => {
        const pages = await router.getRoutes();
        const landing = pages.find(p => p.url === "/");
        expect(landing.hasPart.length).toBe(2);
    });

    it('set canonical url for blogs/blog1', async () => {
        const pages = await router.getRoutes();
        const blog1 = pages.filter(p => p.url === "/blog1")[0];
        expect(blog1.mainEntity.mainEntityOfPage).toBe("/canonical/blog1");

        const canonical = pages.filter(p => p.url === "/canonical/blog1")[0];
        expect(canonical.mainEntity.mainEntityOfPage).toBe("/canonical/blog1");
    });


});