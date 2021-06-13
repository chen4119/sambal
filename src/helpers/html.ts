import {Parser} from "htmlparser2";
import {Handler} from "htmlparser2/lib/Parser";

// const SAMBAL_SLOT_NAME = "sambal-slot";
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

type HtmlAttributes = {
    [propName: string]: string
};

type EditAttribsFn = (name: string, attribs: HtmlAttributes) => HtmlAttributes;
export async function replaceScriptSrc(srcHtml: string, editAttribs: EditAttribsFn): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const handler = getHtmlSerializer(resolve, reject, editAttribs);
        const parser = new Parser(handler);
        parser.write(srcHtml);
        parser.end();
    });
}

function getHtmlSerializer(
    resolve,
    reject,
    editAttribs: EditAttribsFn) {

    let html = '';
    const handler: Partial<Handler> = {
        onopentag: (name,  attribs) => {
            const updatedAttribs = editAttribs ? editAttribs(name, attribs) : attribs;
            html += addOpeningTag(name, updatedAttribs);
            
        },
        ontext:(data) => {
            html += data;
        },
        onclosetag: (name) => {
            html += addClosingTag(name);
        },
        onprocessinginstruction: (name, data) => {
            html += addProcessingInstruction(data);
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

function addOpeningTag(name: string, attribs?: HtmlAttributes) {
    let attributes = '';
    if (attribs) {
        for (const key of Object.keys(attribs)) {
            attributes += ` ${key}="${attribs[key]}"`;
        }
    }
    return `<${name}${attributes}>`;
}

function addClosingTag(name: string) {
    if (SELF_CLOSING_TAGS.indexOf(name) >= 0) {
        return '';
    }
    return `</${name}>`;
}

function addProcessingInstruction(data: string) {
    return `<${data}>\n`;
}


