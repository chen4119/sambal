import {pipe, Observable} from "rxjs";
import {mergeMap} from "rxjs/operators";
import * as cheerio from "cheerio";
import LocalCss from "../LocalCss";
import {SambalData} from "../constants";

export function render(renderer: (props: any) => Promise<string>) {
    return pipe<Observable<SambalData>, Observable<SambalData>>(
        mergeMap(async (content: SambalData) => {
            const css = new LocalCss();
            const html = await renderer({...content.data, css: css});
            const $ = cheerio.load(html);
            if (css.hasSheets()) {
                $("head").append(`
                    <style>
                        ${css.getCss()}
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
