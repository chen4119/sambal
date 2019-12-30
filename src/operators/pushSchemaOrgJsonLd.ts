import {pipe, Observable} from "rxjs";
import {map} from "rxjs/operators";
import {SambalData} from "../constants";

export function pushSchemaOrgJsonLd(renderer: (props: any) => any) {
    return pipe<Observable<SambalData>, Observable<SambalData>>(
        map((content) => {
            if (!content.jsonld) {
                content.jsonld = [];
            }
            const schemaOrgJsonLd = renderer(content.data);
            if (schemaOrgJsonLd) {
                content.jsonld.push(schemaOrgJsonLd);
            }
            return content;
        })
    );
}
