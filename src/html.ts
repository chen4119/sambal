import {Parser} from "htmlparser2";
import {Handler} from "htmlparser2/lib/Parser";
import {safeParseJson} from "./utils";
const SPACING: number = 4;
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
    body?: string,
}

export async function getJsonLd(srcHtml: string) {
    return new Promise<any[]>((resolve, reject) => {
        let allJsonLds = [];
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

export async function editHtml(
    srcHtml: string,
    editAttribs: (name: string, attribs: HtmlAttributes) => HtmlAttributes
) {
    return new Promise<string>((resolve, reject) => {
        let html: string = '';
        const handler: Partial<Handler> = {
            onopentag: (name,  attribs) => {
                const updatedAttribs = editAttribs(name, attribs);
                html += addOpeningTag(0, name, updatedAttribs);
            },
            ontext:(data) => {
                html += data;
            },
            onclosetag: (name) => {
                html += addClosingTag(0, name);
            },
            onprocessinginstruction: (name, data) => {
                html += addProcessingInstruction(0, data);
            },
            onerror: (err) => {
                reject(err);
            },
            onend: () => {
                resolve(html);
            }
        };
        const parser = new Parser(handler);
        parser.write(srcHtml);
        parser.end();
    });
}

export async function prettify(srcHtml: string, appendHeadNodes: HtmlNode[] = []) {
    return new Promise<string>((resolve, reject) => {
        let foundHead = false;
        let isAppendedHeadNodes = appendHeadNodes.length > 0 ? false : true;
        const preOpenTag = (name) => {
            if (name === 'head') {
                foundHead = true;
            } else if (name === 'body' && !foundHead) {
                // automatically add head if none found by the time we get to <body>
                handler.onopentag('head', null);
                handler.onclosetag('head');
            }
        };
        const preCloseTag = (name) => {
            if (name === 'head' && !isAppendedHeadNodes) {
                for (const node of appendHeadNodes) {
                    handler.onopentag(node.name, node.attributes);
                    handler.ontext(node.body);
                    handler.onclosetag(node.name);
                }
                isAppendedHeadNodes = true;
            }
        };
        const handler = getHtmlSerializer(resolve, reject, preOpenTag, preCloseTag);
        const parser = new Parser(handler);
        parser.write(srcHtml);
        parser.end();
    });
}

function getHtmlSerializer(resolve, reject, preOpenTag?, preCloseTag?) {
    let html: string = '';
    let indent: number = 0;
    let prev: string = null;
    let insidePreTag: boolean = false;
    const handler: Partial<Handler> = {
        onopentag: (name,  attribs) => {
            if (preOpenTag) {
                preOpenTag(name, attribs);
            }
            if (!insidePreTag && prev === OPEN) {
                indent ++;
                html += `\n${addOpeningTag(indent, name, attribs)}`;
            } else if (!insidePreTag && prev === CLOSE) {
                html += addOpeningTag(indent, name, attribs);
            } else {
                html += addOpeningTag(0, name, attribs);
            }
            prev = OPEN;
            if (name === 'pre') {
                insidePreTag = true;
            }
        },
        ontext:(data) => {
            const trimmed = data.trim();
            if (trimmed) {
                html += trimmed;
                prev = TEXT;
            }
        },
        onclosetag: (name) => {
            if (preCloseTag) {
                preCloseTag(name);
            }
            if (insidePreTag) {
                html += addClosingTag(0, name);
            } else if (prev === TEXT || prev === OPEN) {
                html += `${addClosingTag(0, name)}\n`;
            } else {
                indent = Math.max(0, indent - 1);
                html += `${addClosingTag(indent, name)}\n`;
            }
            prev = CLOSE;
            if (name === 'pre') {
                insidePreTag = false;
                html += '\n';
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
