import postcss from "postcss";
import {readFile, writeFile} from "./utils";
import path from "path";
import {OUTPUT_FOLDER} from "./constants";

export async function importCssModule(filePath: string) {
    // console.log(process.cwd());
    return new Promise(async (resolve, reject) => {
        let cssJson = null;
        const css = await readFile(path.resolve(filePath));
        const output = path.join(OUTPUT_FOLDER, filePath);
        const result = await postcss([require('postcss-modules')({
            getJSON: function(cssFileName, json, outputFileName) {
                cssJson = json;
            }
        })]).process(css, {from: filePath, to: output});
        await writeFile(output, result.css);
        resolve(cssJson);
    });
}