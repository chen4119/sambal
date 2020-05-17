import {pipe} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {SAMBAL_INTERNAL} from "../constants";

export function listJsonLd() {
    return pipe(
        mergeMap(async d => {
            if (d[SAMBAL_INTERNAL].jsonld && d[SAMBAL_INTERNAL].jsonld.length > 0) {
                return d[SAMBAL_INTERNAL].jsonld;
            }
            return null;
        })
    );
}