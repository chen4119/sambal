import Renderer from "../src/Renderer";
import CollectionBuilder from "../src/CollectionBuilder";
import Graph from "../src/Graph";
import Media from "../src/Media";
import Links from "../src/Links";
import { DEV_PUBLIC_PATH } from "../src/helpers/constant";

describe("Renderer", () => {
    const baseUrl = "https://example.com";
    let renderer: Renderer;
    let graph: Graph;
    let links: Links;
    let collectionBuilder: CollectionBuilder;

    beforeEach(async () => {
        links = new Links();
        collectionBuilder = new CollectionBuilder([]);
        graph = new Graph(baseUrl, new Media([]), links, collectionBuilder);
        renderer = new Renderer(null, "mock-theme", DEV_PUBLIC_PATH, graph);
        await renderer.init();
    });

    it('render using mock-theme', async () => {
        const result = await renderer.renderPage({});
        expect(result).toMatchSnapshot();
    });



});