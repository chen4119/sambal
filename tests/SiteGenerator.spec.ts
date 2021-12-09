import { OUTPUT_FOLDER } from "../src/helpers/constant";
import { getAbsFilePath } from "../src/helpers/util";
import Renderer from "../src/Renderer";
import SiteGenerator from "../src/SiteGenerator";
import { init } from "./setup";

describe("SiteGenerator", () => {
    const baseUrl = "https://example.com";
    let siteGenerator: SiteGenerator;


    beforeEach(async () => {
        const classes = await init(OUTPUT_FOLDER);
        const renderer = new Renderer(baseUrl, OUTPUT_FOLDER, getAbsFilePath("tests/mock/sambal.entry.js"), null);
        await renderer.bundle();
        siteGenerator = new SiteGenerator(baseUrl, classes.uriResolver, classes.router, renderer);
    });

    it('build', async () => {
        await siteGenerator.buildPages();
        await siteGenerator.buildJsonLds();
        await siteGenerator.generateSiteMap();
    });

});