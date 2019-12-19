import {pipe} from "rxjs";
import {mergeMap} from "rxjs/operators";
import * as cheerio from 'cheerio';

export function render(renderer: (props: any) => Promise<string>) {
    return pipe(
        mergeMap(async (content: any) => {
            const html = await renderer({...content.data, _path: content.path});
            const $ = cheerio.load(html);
            return {
                ...content,
                html: $
            };
        })
    );
}