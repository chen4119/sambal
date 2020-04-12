import {pipe, Observable} from "rxjs";
import {map} from "rxjs/operators";
import {SambalData, SAMBAL_INTERNAL} from "../constants";

export function pushSchemaOrgJsonLd(transformer: (props: any) => any) {
    return pipe<Observable<any>, Observable<SambalData>>(
        map((data) => {
            if (!data[SAMBAL_INTERNAL]) {
                data[SAMBAL_INTERNAL] = {};
            }
            if (!data[SAMBAL_INTERNAL].jsonld) {
                data[SAMBAL_INTERNAL].jsonld = [];
            }
            const schemaOrgJsonLd = transformer(data);
            if (schemaOrgJsonLd) {
                data[SAMBAL_INTERNAL].jsonld.push(schemaOrgJsonLd);
            }
            return data;
        })
    );
}
