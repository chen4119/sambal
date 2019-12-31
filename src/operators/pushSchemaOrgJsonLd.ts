import {pipe, Observable} from "rxjs";
import {map} from "rxjs/operators";
import {SambalData, SAMBAL_INTERNAL} from "../constants";

export function pushSchemaOrgJsonLd(renderer: (props: any) => any) {
    return pipe<Observable<SambalData>, Observable<SambalData>>(
        map((data) => {
            if (!data[SAMBAL_INTERNAL]) {
                data[SAMBAL_INTERNAL] = {uri: ""};
            }
            if (!data[SAMBAL_INTERNAL].jsonld) {
                data[SAMBAL_INTERNAL].jsonld = [];
            }
            const schemaOrgJsonLd = renderer(data);
            if (schemaOrgJsonLd) {
                data[SAMBAL_INTERNAL].jsonld.push(schemaOrgJsonLd);
            }
            return data;
        })
    );
}
