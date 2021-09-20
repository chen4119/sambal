import { getAbsFilePath } from "../src/helpers/util";
import Renderer from "../src/Renderer";
import SiteGenerator from "../src/SiteGenerator";
import { init } from "./setup";

describe("SiteGenerator", () => {
    const baseUrl = "https://example.com";
    let siteGenerator: SiteGenerator;


    beforeEach(async () => {
        const classes = await init();
        const renderer = new Renderer(baseUrl, getAbsFilePath("tests/mock/sambal.entry.js"), null);
        await renderer.build("/js");
        siteGenerator = new SiteGenerator(baseUrl, classes.uriResolver, classes.router, renderer);
    });

    it('build', async () => {
        await siteGenerator.buildPages("/js");
        await siteGenerator.buildJsonLds();
        await siteGenerator.generateSiteMap();
    });

});