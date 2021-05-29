import Renderer from "../src/Renderer";
import SiteGenerator from "../src/SiteGenerator";
import { init } from "./setup";

describe("SiteGenerator", () => {
    const baseUrl = "https://example.com";
    let siteGenerator: SiteGenerator;


    beforeEach(async () => {
        const classes = init();
        const renderer = new Renderer(null, "mock-theme");
        siteGenerator = new SiteGenerator(classes.router, renderer);
    });

    it('buildJsonLds', async () => {
        await siteGenerator.buildJsonLds(baseUrl);
    });

});