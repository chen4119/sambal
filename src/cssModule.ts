import postcss from "postcss";
import {readFile} from "./utils";
import path from "path";
import shelljs from "shelljs";

const cssModuleCache = new Map<string, {json: object, css: string}>();

export async function importCssModule(filePath: string) {
    return new Promise(async (resolve, reject) => {
        const resolvedPath = path.resolve(filePath);
        if (!shelljs.test("-e", resolvedPath)) {
            reject(`${filePath} not found`);
            return;
        }
        if (cssModuleCache.has(resolvedPath)) {
            resolve(cssModuleCache.get(resolvedPath));
            return;
        }
        let cssJson = null;
        try {
            const css = await readFile(resolvedPath);
            const result = await postcss([
                require('postcss-modules')({
                getJSON: function(cssFileName, json, outputFileName) {
                    cssJson = json;
                }
            })]).process(css, {from: filePath});
            const bundle = {
                json: cssJson,
                css: result.css
            };
            cssModuleCache.set(resolvedPath, bundle);
            resolve(bundle);
        } catch (e) {
            reject(e);
        }
    });
}
