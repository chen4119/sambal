import Renderer from "../src/Renderer";
import SiteGenerator from "../src/SiteGenerator";
import { init } from "./setup";

describe("SiteGenerator", () => {
    const baseUrl = "https://example.com";
    let siteGenerator: SiteGenerator;


    beforeEach(async () => {
        const classes = await init();
        const renderer = new Renderer(baseUrl, null, "mock-theme");
        siteGenerator = new SiteGenerator(baseUrl, classes.router, renderer);
    });

    it('build', async () => {
        await siteGenerator.buildPages("/js");
        await siteGenerator.generateSiteMap();
    });

    it('buildJsonLds', async () => {
        await siteGenerator.buildJsonLds();
    });

});