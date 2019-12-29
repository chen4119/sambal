import {pipe, Observable} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {toJsonLdGraph, toSchemaOrgJsonLd, SCHEMA_CONTEXT} from "sambal-jsonld";
import {queryData} from "../utils";
import * as cheerio from "cheerio";
import LocalCss from "../LocalCss";
import {SambalData} from "../constants";

export function render(renderer: (props: any) => Promise<string>, withSchemaOrg?: {type: string, field?: string, context?: any}) {
    return pipe<Observable<SambalData>, Observable<SambalData>>(
        mergeMap(async (content: SambalData) => {
            const css = new LocalCss();
            const html = await renderer({...content.data, css: css});
            const $ = cheerio.load(html);
            if (css.hasSheets()) {
                $("head").append(`
                    <style>
                        ${css.getCss()}
                    </style>
                `);
            }
            if (withSchemaOrg) {
                addSchemaOrg($, content.data, withSchemaOrg.type, withSchemaOrg.field, withSchemaOrg.context);
            }
            return {
                ...content,
                html: $
            };
        })
    );
}

function addSchemaOrg($: CheerioStatic, data: any, type: string, field?: string, context?: any) {
    let json = data;
    if (field) {
        json = queryData(data, field);
    }
    const schemaOrgJsonLds = [];
    if (Array.isArray(json)) {
        json.forEach(item => {
            const schemaOrgJsonLd = toSchemaOrgJsonLd(item, type, context);
            schemaOrgJsonLds.push(schemaOrgJsonLd);
        });
    } else {
        const schemaOrgJsonLd = toSchemaOrgJsonLd(json as object, type, context);
        schemaOrgJsonLds.push(schemaOrgJsonLd);
    }
    const schemaOrgJson = toJsonLdGraph(schemaOrgJsonLds, SCHEMA_CONTEXT);
    if (schemaOrgJson) {
        const jsonLdBlock = $('<script type="application/ld+json"></script>').appendTo($("head"));
        jsonLdBlock.text(JSON.stringify(schemaOrgJson));
    }
}