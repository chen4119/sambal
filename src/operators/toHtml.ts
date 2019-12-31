import {pipe} from "rxjs";
import {map} from "rxjs/operators";
import {addJsonLdToDOM} from "./addJsonLdToDOM";
import {SAMBAL_INTERNAL} from "../constants";

export function toHtml() {
    return pipe(
        addJsonLdToDOM(),
        map(d => {
            if (d[SAMBAL_INTERNAL] && d[SAMBAL_INTERNAL].html) {
                const $ = d[SAMBAL_INTERNAL].html;
                return $.html();
            }
            return "";
        })
    );
}