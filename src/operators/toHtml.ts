import {pipe} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {SAMBAL_INTERNAL} from "../constants";
import Logger from "../Logger";
import {prettify, HtmlNode, HtmlAttributes} from "../html";
import {toJsonLdGraph, SCHEMA_CONTEXT} from "sambal-jsonld";


const log: Logger = new Logger({name: "toHtml"});
export function toHtml(mutateHtml: {
    editAttribs?: (name: string, attribs: HtmlAttributes) => HtmlAttributes,
    prepend?: (name: string, attribs: HtmlAttributes) => HtmlNode[],
    append?: (name: string, attribs: HtmlAttributes) => HtmlNode[],
    replace?: (name: string, attribs: HtmlAttributes) => HtmlNode
} = {}) {
    return pipe(
        mergeMap(async d => {
            if (d[SAMBAL_INTERNAL] && d[SAMBAL_INTERNAL].html) {
                const injectHeadNodes: HtmlNode[] = [];
                if (d[SAMBAL_INTERNAL].css && d[SAMBAL_INTERNAL].css.hasSheets()) {
                    injectHeadNodes.push({
                        name: "style",
                        body: d[SAMBAL_INTERNAL].css.getCss()
                    });
                }
                if (d[SAMBAL_INTERNAL].jsonld && d[SAMBAL_INTERNAL].jsonld.length > 0) {
                    const schemaOrgJson = toJsonLdGraph(d[SAMBAL_INTERNAL].jsonld, SCHEMA_CONTEXT);
                    injectHeadNodes.push({
                        name: "script",
                        body: JSON.stringify(schemaOrgJson),
                        attributes: {
                            type: "application/ld+json"
                        }
                    });
                }
                return await editHtml(
                    d[SAMBAL_INTERNAL].html,
                    injectHeadNodes,
                    mutateHtml.editAttribs ? mutateHtml.editAttribs : NOOP_EDIT_ATTRIBS,
                    mutateHtml.prepend ? mutateHtml.prepend : NOOP_PREPEND,
                    mutateHtml.append ? mutateHtml.append : NOOP_APPEND,
                    mutateHtml.replace ? mutateHtml.replace : NOOP_REPLACE,
                );
            }
            log.warn("No html rendered.  Need to call render first");
            return "";
        })
    );
}

async function editHtml(srcHtml: string,
    injectHeadNodes: HtmlNode[],
    userDefinedEditAttribs: (name: string, attribs: HtmlAttributes) => HtmlAttributes,
    userDefinedPrepend: (name: string, attribs: HtmlAttributes) => HtmlNode[],
    userDefinedAppend: (name: string, attribs: HtmlAttributes) => HtmlNode[],
    userDefinedReplace: (name: string, attribs: HtmlAttributes) => HtmlNode
) {
    let isAdded = injectHeadNodes.length > 0 ? false : true;
    return await prettify(
        srcHtml,
        userDefinedEditAttribs,
        (name: string, attribs: HtmlAttributes) => {
            let prependNodes = userDefinedPrepend(name, attribs);
            if (!isAdded && name === 'body') {
                isAdded = true;
                const node = {
                    name: 'head',
                    body: injectHeadNodes
                };
                if (!prependNodes) {
                    prependNodes = [node];
                } else {
                    prependNodes.push(node);
                }
            }
            return prependNodes;
        },
        (name: string, attribs: HtmlAttributes) => {
            let appendNodes = userDefinedAppend(name, attribs);
            if (!isAdded && name === 'head') {
                isAdded = true;
                if (!appendNodes) {
                    appendNodes = injectHeadNodes;
                } else {
                    appendNodes = appendNodes.concat(injectHeadNodes);
                }
            }
            return appendNodes;
        },
        userDefinedReplace
    );
}

const NOOP_EDIT_ATTRIBS = (name: string, attribs: HtmlAttributes) => attribs;
const NOOP_PREPEND = (name: string, attribs: HtmlAttributes) => null;
const NOOP_APPEND = (name: string, attribs: HtmlAttributes) => null;
const NOOP_REPLACE = (name: string, attribs: HtmlAttributes) => null;