import shelljs from "shelljs";
import Renderer from "../src/Renderer";
import { OUTPUT_FOLDER } from "../src/helpers/constant";

describe("Renderer", () => {
    const baseUrl = "https://example.com";
    let renderer: Renderer;

    beforeEach(async () => {
        renderer = new Renderer(baseUrl, OUTPUT_FOLDER, null, "mock-theme");
        await renderer.bundle();
    });

    afterEach(async () => {
        shelljs.rm("-rf", OUTPUT_FOLDER);
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