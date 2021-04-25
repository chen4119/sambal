import axios, { AxiosResponse } from "axios";
import Renderer from "../src/Renderer";
import CollectionBuilder from "../src/CollectionBuilder";
import Graph from "../src/Graph";
import Media from "../src/Media";
import Links from "../src/Links";
import DevServer from "../src/DevServer";
import { WebPage, DEV_PUBLIC_PATH } from "../src/helpers/constant";

describe("Renderer", () => {
    const baseUrl = "https://example.com";
    let renderer: Renderer;
    let graph: Graph;
    let links: Links;
    let collectionBuilder: CollectionBuilder;
    let server: DevServer;

    const pages: WebPage[] = [
        {
            "@id": "https://example.com",
            "@type": "WebSite",
            url: "/",
            mainEntity: {
                headline: "hello worlds"
            }
        }
    ];

    beforeAll(async () => {
        links = new Links();
        collectionBuilder = new CollectionBuilder([]);
        graph = new Graph(baseUrl, new Media([]), links, collectionBuilder);
        renderer = new Renderer(null, "mock-theme", graph);
        await renderer.initTheme();
        server = new DevServer(renderer, 3000);
        server.start(pages);
    });

    afterAll(() => {
        server.stop();
    })

    it('render html', async () => {
        const response = await axios.get("http://localhost:3000");
        expect(response.data).toMatchSnapshot();
    });

    it('get client bundle', async () => {
        const response = await axios.get("http://localhost:3000/_theme/client.123.js");
        expect(response.data).toMatchSnapshot();
    });



});