import shelljs from "shelljs";
import Renderer from "../src/Renderer";
import { OUTPUT_FOLDER } from "../src/helpers/constant";

describe("Renderer", () => {
    const baseUrl = "https://example.com";
    let renderer: Renderer;

    beforeEach(async () => {
        renderer = new Renderer(null, "mock-theme");
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
        const result = await renderer.renderPage({
            "@type": "WebPage",
            url: "/dummy",
            mainEntity: {
                "@type": "Person",
                name: "John Smith"
            },
        }, "/js");
        expect(result).toMatchSnapshot();
    });



});