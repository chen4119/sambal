import Bundler from "../src/Bundler";
import shelljs from "shelljs";
import { OUTPUT_FOLDER } from "../src/helpers/constant";


describe("Bundler", () => {
    let assetMap: Map<string, string>;
    beforeEach(async () => {
        assetMap = new Map<string, string>();
    });

    
    it('bundleCssFile', async () => {
        await Bundler.bundleCssFile(assetMap, "css/index.css", OUTPUT_FOLDER);

        const absImagePath = "/Users/chen4119/Documents/dev/sambal/data/images/image2.jpg";
        expect(assetMap.get(absImagePath)).toBe("data/images/image2.9af4e4192b910e72f3ae07dcdbacc34f4c6985cf.jpg");

        const destCssFile = `${OUTPUT_FOLDER}/css/index.b344f0da1a8be14152867c308e96aa5ce4028e5f.css`;
        const destImageFile = `${OUTPUT_FOLDER}/data/images/image2.9af4e4192b910e72f3ae07dcdbacc34f4c6985cf.jpg`;
        expect(shelljs.test('-f', destCssFile)).toBeTruthy();
        expect(shelljs.test('-f', destImageFile)).toBeTruthy();
    });

    /*
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
        console.log(resultCss);
    });*/

});