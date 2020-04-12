import {pipe, Observable} from "rxjs";
import {mergeMap} from "rxjs/operators";
import * as cheerio from "cheerio";
import LocalCss from "../LocalCss";
import {SambalData, SAMBAL_INTERNAL} from "../constants";

export function render(renderer: (props: any) => Promise<string>) {
    return pipe<Observable<any>, Observable<SambalData>>(
        mergeMap(async (data: any) => {
            const css = new LocalCss();
            const html = await renderer({...data, css: css});
            const $ = cheerio.load(html);
            if (css.hasSheets()) {
                $("head").append(`
                    <style>
                        ${css.getCss()}
                    </style>
                `);
            }
            if (!data[SAMBAL_INTERNAL]) {
                data[SAMBAL_INTERNAL] = {};
            }
            data[SAMBAL_INTERNAL].html = $;
            return data;
        })
    );
}
