import {pipe} from "rxjs";
import {tap} from "rxjs/operators";
import {SAMBAL_INTERNAL} from "../constants";

export function dom(mapper: ($: CheerioStatic) => void) {
    return pipe(
        tap(d => {
            if (d[SAMBAL_INTERNAL] && d[SAMBAL_INTERNAL].html) {
                const $ = d[SAMBAL_INTERNAL].html;
                mapper($);
            }
        })
    );
}