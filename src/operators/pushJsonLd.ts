import {pipe, Observable} from "rxjs";
import {map} from "rxjs/operators";
import {SambalData, SAMBAL_INTERNAL} from "../constants";

export function pushJsonLd(transformer: (props: any) => any) {
    return pipe<Observable<any>, Observable<SambalData>>(
        map((data) => {
            if (!data[SAMBAL_INTERNAL]) {
                data[SAMBAL_INTERNAL] = {};
            }
            if (!data[SAMBAL_INTERNAL].jsonld) {
                data[SAMBAL_INTERNAL].jsonld = [];
            }
            const jsonld = transformer(data);
            if (jsonld) {
                data[SAMBAL_INTERNAL].jsonld.push(jsonld);
            }
            return data;
        })
    );
}
