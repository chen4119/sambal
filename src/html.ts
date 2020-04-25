import {Parser} from "htmlparser2";
import {Handler} from "htmlparser2/lib/Parser";
import {safeParseJson} from "./utils";
const INDENT: number = 4;
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
        const parser = new Parser(handler, { decodeEntities: true });
        parser.write(srcHtml);
        parser.end();
    });
}

export async function prettify(srcHtml: string, appendHeadNodes: HtmlNode[] = []) {
    return new Promise<string>((resolve, reject) => {
        let html: string = '';
        let spacing: number = 0;
        let foundHead = false;
        let isAppendedHeadNodes = appendHeadNodes.length > 0 ? false : true;
        const handler: Partial<Handler> = {
            onopentag: (name,  attribs) => {
                if (name === 'head') {
                    foundHead = true;
                } else if (name === 'body' && !foundHead) {
                    // automatically add head if none found by the time we get to <body>
                    handler.onopentag('head', null);
                    handler.onclosetag('head');
                }
                html += addOpeningTag(spacing, name, attribs);
                spacing += INDENT;
            },
            ontext:(data) => {
                html += addText(spacing, data);
            },
            onclosetag: (name) => {
                if (name === 'head' && !isAppendedHeadNodes) {
                    html += addNodesToHtml(spacing, appendHeadNodes);
                    isAppendedHeadNodes = true;
                }
                spacing -= INDENT;
                html += addClosingTag(spacing, name);
            },
            onprocessinginstruction: (name, data) => {
                html += addProcessingInstruction(spacing, data);
            },
            onerror: (err) => {
                reject(err);
            },
            onend: () => {
                resolve(html);
            }
        };
        const parser = new Parser(handler, { decodeEntities: true });
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
        let spacing: number = 0;
        const handler: Partial<Handler> = {
            onopentag: (name,  attribs) => {
                const updatedAttribs = editAttribs(name, attribs);
                html += addOpeningTag(spacing, name, updatedAttribs);
                spacing += INDENT;
            },
            ontext:(data) => {
                html += addText(spacing, data);
            },
            onclosetag: (name) => {
                spacing -= INDENT;
                html += addClosingTag(spacing, name);
            },
            onprocessinginstruction: (name, data) => {
                html += addProcessingInstruction(spacing, data);
            },
            onerror: (err) => {
                reject(err);
            },
            onend: () => {
                resolve(html);
            }
        };
        const parser = new Parser(handler, { decodeEntities: true });
        parser.write(srcHtml);
        parser.end();
    });
}

function addNodesToHtml(spacing: number, nodes: HtmlNode[]) {
    let html = '';
    for (const node of nodes) {
        html += addOpeningTag(spacing, node.name, node.attributes);
        html += addText(spacing + INDENT, node.body);
        html += addClosingTag(spacing, node.name);
    }
    return html;
}

function addOpeningTag(spacing: number, name: string, attribs?: HtmlAttributes) {
    let attributes = '';
    if (attribs) {
        for (const key of Object.keys(attribs)) {
            attributes += ` ${key}="${attribs[key]}"`;
        }
    }
    return `${makeIndent(spacing)}<${name}${attributes}>\n`
}

function addText(spacing: number, data: string) {
    if (data && data.trim()) {
        return `${makeIndent(spacing)}${data}\n`;
    }
    return '';
}

function addClosingTag(spacing: number, name: string) {
    if (SELF_CLOSING_TAGS.indexOf(name) >= 0) {
        return '';
    }
    return `${makeIndent(spacing)}</${name}>\n`;
}

function addProcessingInstruction(spacing: number, data: string) {
    return `${makeIndent(spacing)}<${data}>\n`;
}

function makeIndent(numSpaces: number) {
    let indent = '';
    for (let i = 0; i < numSpaces; i++) {
        indent += ' ';
    }
    return indent;
}
