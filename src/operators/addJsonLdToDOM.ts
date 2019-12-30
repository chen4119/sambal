import {pipe, Observable} from "rxjs";
import {map} from "rxjs/operators";
import {SambalData} from "../constants";
import {toJsonLdGraph, SCHEMA_CONTEXT} from "sambal-jsonld";

export function addJsonLdToDOM() {
    return pipe<Observable<SambalData>, Observable<SambalData>>(
        map((data) => {
            if (data.html && data.jsonld && data.jsonld.length > 0) {
                const schemaOrgJson = toJsonLdGraph(data.jsonld, SCHEMA_CONTEXT);
                if (schemaOrgJson) {
                    const $ = data.html;
                    const jsonLdBlock = $('<script type="application/ld+json"></script>').appendTo($("head"));
                    jsonLdBlock.text(JSON.stringify(schemaOrgJson));
                }
            }
            return data;
        })
    );
}