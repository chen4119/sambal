import shelljs from "shelljs";
import Renderer from "../src/Renderer";
import CollectionBuilder from "../src/CollectionBuilder";
import Graph from "../src/Graph";
import Media from "../src/Media";
import Links from "../src/Links";
import { OUTPUT_FOLDER } from "../src/helpers/constant";

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
        renderer = new Renderer(null, "mock-theme", graph);
    });

    afterEach(async () => {
        shelljs.rm("-rf", OUTPUT_FOLDER);
    });

    it('copy theme bundle to /public', async () => {
        await renderer.build("/js");
        expect(shelljs.test('-f', "public/js/mock-theme/client.123.js")).toBeTruthy();
    });

    it('render using mock-theme', async () => {
        await renderer.build("/js");
        const result = await renderer.renderPage({}, "/js");
        expect(result).toMatchSnapshot();
    });



});