import {pipe, Observable} from "rxjs";
import {mergeMap} from "rxjs/operators";
import LocalCss from "../LocalCss";
import {SambalData, SAMBAL_INTERNAL} from "../constants";
import {prettify, HtmlNode} from "../html";
import {toJsonLdGraph, SCHEMA_CONTEXT} from "sambal-jsonld";

export function render(renderer: (props: any) => Promise<string>) {
    return pipe<Observable<any>, Observable<SambalData>>(
        mergeMap(async (data: any) => {
            const css = new LocalCss();
            const html = await renderer({...data, css: css});
            const injectHeadNodes: HtmlNode[] = [];

            if (css.hasSheets()) {
                injectHeadNodes.push({
                    name: "style",
                    body: css.getCss()
                });
            }
            if (!data[SAMBAL_INTERNAL]) {
                data[SAMBAL_INTERNAL] = {};
            }
            if (data[SAMBAL_INTERNAL].jsonld && data[SAMBAL_INTERNAL].jsonld.length > 0) {
                const schemaOrgJson = toJsonLdGraph(data[SAMBAL_INTERNAL].jsonld, SCHEMA_CONTEXT);
                injectHeadNodes.push({
                    name: "script",
                    body: JSON.stringify(schemaOrgJson),
                    attributes: {
                        type: "application/ld+json"
                    }
                });
            }
            data[SAMBAL_INTERNAL].html = await prettify(html, injectHeadNodes);
            return data;
        })
    );
}
