import {pipe, Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {SambalData, SAMBAL_INTERNAL} from "../constants";
import {toJsonLdGraph, SCHEMA_CONTEXT} from "sambal-jsonld";

export function addJsonLdToDOM() {
    return pipe<Observable<SambalData>, Observable<SambalData>>(
        tap((data) => {
            const sambalInternal = data[SAMBAL_INTERNAL];
            if (sambalInternal && sambalInternal.html && sambalInternal.jsonld && sambalInternal.jsonld.length > 0) {
                const schemaOrgJson = toJsonLdGraph(sambalInternal.jsonld, SCHEMA_CONTEXT);
                if (schemaOrgJson) {
                    const $ = sambalInternal.html;
                    const jsonLdBlock = $('<script type="application/ld+json"></script>').appendTo($("head"));
                    jsonLdBlock.text(JSON.stringify(schemaOrgJson));
                }
            }
        })
    );
}