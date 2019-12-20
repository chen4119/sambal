import {pipe} from "rxjs";
import {mergeMap} from "rxjs/operators";
import * as cheerio from 'cheerio';
import {importCssModule} from "../cssModule";

export function render(renderer: (props: any) => Promise<string>, withStyle?: string) {
    return pipe(
        mergeMap(async (content: any) => {
            let cssModule = null;
            if (withStyle) {
                cssModule = await importCssModule(withStyle);
            }
            const html = await renderer({...content.data, _path: content.path, classes: cssModule ? cssModule.json : null});;
            const $ = cheerio.load(html);
            if (cssModule) {
                $("head").append(`
                    <style>
                        ${cssModule.css}
                    </style>
                `);
            }
            return {
                ...content,
                html: $
            };
        })
    );
}