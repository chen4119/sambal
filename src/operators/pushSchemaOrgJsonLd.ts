import {pipe, Observable} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {SambalData} from "../constants";

export function pushSchemaOrgJsonLd(renderer: (props: any) => Promise<any>) {
    return pipe<Observable<SambalData>, Observable<SambalData>>(
        mergeMap(async (content) => {
            if (!content.jsonld) {
                content.jsonld = [];
            }
            const schemaOrgJsonLd = await renderer(content.data);
            if (schemaOrgJsonLd) {
                content.jsonld.push(schemaOrgJsonLd);
            }
            return content;
        })
    );
}
