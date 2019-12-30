import {pipe} from "rxjs";
import {map} from "rxjs/operators";
import {addJsonLdToDOM} from "./addJsonLdToDOM";

export function toHtml() {
    return pipe(
        addJsonLdToDOM(),
        map(d => {
            if (d.html) {
                const $ = d.html;
                return $.html();
            }
            return "";
        })
    );
}