import {pipe} from "rxjs";
import {mergeMap} from "rxjs/operators";
import * as cheerio from 'cheerio';
import {importCssModule} from "../cssModule";

export function render(renderer: (props: any) => Promise<string>, withStyle?: string) {
    return pipe(
        mergeMap(async (content: any) => {
            let cssModule = null;
            let html = "";
            if (withStyle) {
                cssModule = await importCssModule(withStyle);
                html = await renderer({...content.data, _path: content.path, classes: cssModule.json});
            } else {
                html = await renderer({...content.data, _path: content.path});
            }
            const $ = cheerio.load(html);
            return {
                ...content,
                html: $,
                css: cssModule ? cssModule.css : null
            };
        })
    );
}