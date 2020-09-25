import {Parser} from "htmlparser2";
import {Handler} from "htmlparser2/lib/Parser";
import {safeParseJson} from "./utils";

const SPACING = 4;
const SELF_CLOSING_TAGS = [
    'area',
    'base',
    'br',
    'embed',
    'hr',
    'iframe',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track'
];
const OPEN = "open";
const TEXT = "text";
const CLOSE = "close";

export type HtmlAttributes = {
    [propName: string]: string
};

export type HtmlNode = {
    name: string,
    attributes?: HtmlAttributes
    body?: string | HtmlNode | HtmlNode[]
}

export async function getJsonLd(srcHtml: string) {
    return new Promise<any[]>((resolve, reject) => {
        const allJsonLds = [];
        let isJsonLdInBody = false;
        const handler: Partial<Handler> = {
            onopentag: (name,  attribs) => {
                if (name === 'script' && attribs.type === 'application/ld+json') {
                    isJsonLdInBody = true;
                }
            },
            ontext:(data) => {
                if (isJsonLdInBody) {
                    const jsonld = safeParseJson(data);
                    if (jsonld) {
                        allJsonLds.push(jsonld);
                    }
                    isJsonLdInBody = false;
                }
            },
            onerror: (err) => {
                reject(err);
            },
            onend: () => {
                resolve(allJsonLds);
            }
        };
        const parser = new Parser(handler);
        parser.write(srcHtml);
        parser.end();
    });
}

export async function prettify(
    srcHtml: string,
    editAttribs: (name: string, attribs: HtmlAttributes) => HtmlAttributes,
    prepend: (name: string, attribs: HtmlAttributes) => HtmlNode[],
    append: (name: string, attribs: HtmlAttributes) => HtmlNode[],
    replace: (name: string, attribs: HtmlAttributes) => HtmlNode) {
    return new Promise<string>((resolve, reject) => {
        const handler = getHtmlSerializer(
            resolve,
            reject,
            editAttribs,
            prepend,
            append,
            replace);
        const parser = new Parser(handler);
        parser.write(srcHtml);
        parser.end();
    });
}

function getHtmlSerializer(
    resolve,
    reject,
    editAttribs: (name: string, attribs: HtmlAttributes) => HtmlAttributes,
    prepend: (name: string, attribs: HtmlAttributes) => HtmlNode[],
    append: (name: string, attribs: HtmlAttributes) => HtmlNode[],
    replace: (name: string, attribs: HtmlAttributes) => HtmlNode,
    ) {
    let html = '';
    let indent = 0;
    let prev: string = null;
    let insidePreTag = false;
    const stack: any[] = [];
    let deleteTag: any = null;
    const appendToTag: any[] = [];
    const handler: Partial<Handler> = {
        onopentag: (name,  attribs) => {
            const tag = {name: name};
            stack.unshift(tag);
            if (deleteTag !== null) {
                return;
            }
            const prependNodes = prepend(name, attribs);
            if (prependNodes) {
                for (const node of prependNodes) {
                    recursivelyAddNodes(handler, node);
                }
            }
            const appendNodes = append(name, attribs);
            if (appendNodes) {
                appendToTag.unshift({tag: tag, nodes: appendNodes});
            }
            const replaceNode = replace(name, attribs);
            if (replaceNode) {
                // prepend first
                recursivelyAddNodes(handler, replaceNode);
                deleteTag = tag;
            } else {
                const updatedAttribs = editAttribs(name, attribs);
                if (!insidePreTag && prev === OPEN) {
                    indent ++;
                    html += `\n${addOpeningTag(indent, name, updatedAttribs)}`;
                } else if (!insidePreTag && prev === CLOSE) {
                    html += `\n${addOpeningTag(indent, name, updatedAttribs)}`;
                } else {
                    html += addOpeningTag(0, name, updatedAttribs);
                }
                prev = OPEN;
                if (name === 'pre') {
                    insidePreTag = true;
                }
            }
        },
        ontext:(data) => {
            if (deleteTag !== null) {
                return;
            }
            const trimmed = data.trim();
            if (trimmed) {
                html += data;
                prev = TEXT;
            }
        },
        onclosetag: (name) => {
            const tag = stack.shift();
            if (deleteTag === tag) {
                deleteTag = null;
            } else {
                if (appendToTag.length > 0 && appendToTag[0].tag === tag) {
                    const appendNodes = appendToTag[0].nodes;
                    for (const node of appendNodes) {
                        recursivelyAddNodes(handler, node);
                    }
                    appendToTag.shift();
                }
                if (insidePreTag || prev === TEXT || prev === OPEN) {
                    html += addClosingTag(0, name);
                } else {
                    indent = Math.max(0, indent - 1);
                    html += `\n${addClosingTag(indent, name)}`;
                }
                prev = CLOSE;
                if (name === 'pre') {
                    insidePreTag = false;
                    html += '\n';
                }
            }
        },
        onprocessinginstruction: (name, data) => {
            html += addProcessingInstruction(indent, data);
        },
        onerror: (err) => {
            reject(err);
        },
        onend: () => {
            resolve(html);
        }
    };
    return handler;
}

function recursivelyAddNodes(handler: Partial<Handler>, node: HtmlNode) {
    handler.onopentag(node.name, node.attributes);
    if (node.body) {
        if (typeof(node.body) === "string") {
            handler.ontext(node.body);
        } else if (Array.isArray(node.body)) {
            node.body.forEach(childNode => recursivelyAddNodes(handler, childNode));
        } else {
            recursivelyAddNodes(handler, node.body);
        }
    }
    handler.onclosetag(node.name);
}

function addOpeningTag(indent: number, name: string, attribs?: HtmlAttributes) {
    let attributes = '';
    if (attribs) {
        for (const key of Object.keys(attribs)) {
            attributes += ` ${key}="${attribs[key]}"`;
        }
    }
    return `${makeIndent(indent * SPACING)}<${name}${attributes}>`;
}

function addClosingTag(indent: number, name: string) {
    if (SELF_CLOSING_TAGS.indexOf(name) >= 0) {
        return '';
    }
    return `${makeIndent(indent * SPACING)}</${name}>`;
}

function addProcessingInstruction(indent: number, data: string) {
    return `${makeIndent(indent * SPACING)}<${data}>\n`;
}

function makeIndent(numSpaces: number) {
    let indent = '';
    for (let i = 0; i < numSpaces; i++) {
        indent += ' ';
    }
    return indent;
}
