import Bundler from "../src/Bundler";
import shelljs from "shelljs";
import { OUTPUT_FOLDER } from "../src/helpers/constant";
import { getAbsFilePath } from "../src/helpers/util";

describe("Bundler", () => {
    let assetMap: Map<string, string>;
    beforeEach(async () => {
        assetMap = new Map<string, string>();
    });

    afterEach(async () => {
        shelljs.rm("-rf", OUTPUT_FOLDER);
    });
    
    it('bundleCssFile', async () => {
        await Bundler.bundleCssFile(assetMap, "css/index.css", OUTPUT_FOLDER);

        const absImagePath = getAbsFilePath("data/images/image2.jpg");
        expect(assetMap.get(absImagePath)).toBe("data/images/image2.mvTkGSuRDnLzrgfc26zDT0xphc8.jpg");

        const destCssFile = `${OUTPUT_FOLDER}/css/index.c9sdsI7cdvYi3CkYsj61P6lcyjo.css`;
        const destImageFile = `${OUTPUT_FOLDER}/data/images/image2.mvTkGSuRDnLzrgfc26zDT0xphc8.jpg`;
        expect(shelljs.test('-f', destCssFile)).toBeTruthy();
        expect(shelljs.test('-f', destImageFile)).toBeTruthy();
    });


    it('bundleStyle', async () => {
        const css = `
            h1 {
                background-image: url(data/images/image2.jpg);
            }
            h2 {
                background-image: url(data/images/image2.jpg);
            }
        `;
        const resultCss = await Bundler.bundleStyle(assetMap, css, OUTPUT_FOLDER);
        expect(resultCss).toMatchSnapshot();
    });

});