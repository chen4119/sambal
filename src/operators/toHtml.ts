import {pipe} from "rxjs";
import {map} from "rxjs/operators";

export function toHtml() {
    return pipe(
        map<{html: CheerioStatic}, string>((d) => {
            const $ = d.html;
            return $.html();
        })
    );
}