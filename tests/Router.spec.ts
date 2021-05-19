import Router from "../src/Router";
import CollectionBuilder from "../src/CollectionBuilder";
import Graph from "../src/Graph";
import Media from "../src/Media";
import UriResolver from "../src/UriResolver";
import FileSystemResolver from "../src/resolvers/FileSystemResolver";
import HttpResolver from "../src/resolvers/HttpResolver";
import { CACHE_FOLDER, PAGES_FOLDER, DATA_FOLDER } from "../src/helpers/constant";
import { searchFiles } from "../src/helpers/data";

describe("Router", () => {
    let router: Router;

    const pages = searchFiles(PAGES_FOLDER, "**/*", true);
    const data = searchFiles(DATA_FOLDER, "**/*", true);

    beforeEach(async () => {
        const uriResolver = new UriResolver();
        const graph = new Graph(uriResolver);
        const media = new Media(CACHE_FOLDER, []);
        const collections = new CollectionBuilder([], graph);
        const fsResolver = new FileSystemResolver(pages, data, media, collections);
        const httpResolver = new HttpResolver(media);
        uriResolver.fsResolver = fsResolver;
        uriResolver.httpResolver = httpResolver;
        router = new Router(pages, data, graph);
    });

    it('iterate routes', async () => {
        const routeIterator = router.getRouteIterator();
        let count = 0;
        for await (const route of routeIterator()) {
            count ++;
        }
        expect(count).toBe(4);
    });

    it('get /', async () => {
        const page = await router.getPage("/");
        expect(page).toMatchSnapshot();
    });

    it('get /blogs/blog1', async () => {
        const page = await router.getPage("/blogs/blog1");
        expect(page).toMatchSnapshot();
    });

    it('get /alias/blog1', async () => {
        const page = await router.getPage("/alias/blog1");
        expect(page).toMatchSnapshot();
    });

    it('get /bogus return null', async () => {
        const page = await router.getPage("/bogus");
        expect(page).toBeNull();
    });
});