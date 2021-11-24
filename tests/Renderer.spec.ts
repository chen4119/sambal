import shelljs from "shelljs";
import Renderer from "../src/Renderer";
import { OUTPUT_FOLDER } from "../src/helpers/constant";

describe("Renderer", () => {
    const baseUrl = "https://example.com";
    const publicPath = `${OUTPUT_FOLDER}/js`;
    let renderer: Renderer;

    beforeEach(async () => {
        renderer = new Renderer(baseUrl, publicPath, null, "mock-theme");
        await renderer.bundle();
    });

    afterEach(async () => {
        shelljs.rm("-rf", OUTPUT_FOLDER);
    });

    it(`copy theme bundle to /${OUTPUT_FOLDER}`, async () => {
        expect(shelljs.ls(publicPath).length).toBe(7);
    });

    it('render using mock-theme', async () => {
        const result = await renderer.renderPage({
            "@type": "WebPage",
            url: "/dummy",
            mainEntity: {
                "@type": "Person",
                name: "John Smith"
            },
        });
        expect(result).toMatchSnapshot();
    });



});