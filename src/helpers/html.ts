import {Parser} from "htmlparser2";
import {Handler} from "htmlparser2/lib/Parser";

// TODO: spacing not used.  Remove?
const SPACING = 4;
const SAMBAL_SLOT_NAME = "sambal-slot";
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
    'track',
    SAMBAL_SLOT_NAME
];

type HtmlAttributes = {
    [propName: string]: string
};

export async function replaceScriptSrc(srcHtml: string, replace: (src: string) => string) {
    return new Promise<string>((resolve, reject) => {
        const handler = getHtmlSerializer(resolve, reject, null, (name, attribs) => {
            if (name === "script" && attribs.src) {
                return {
                    ...attribs,
                    src: replace(attribs.src)
                };
            }
            return attribs;
        });
        const parser = new Parser(handler);
        parser.write(srcHtml);
        parser.end();
    });
}

export async function hydrateSambalSlots(
    srcHtml: string,
    render: (id: string) => Promise<string>) {

    const slots = await searchForSambalSlots(srcHtml);
    for (const slot of slots) {
        slot.html = await render(slot.id);
    }

    return new Promise<string>((resolve, reject) => {
        let slotIndex = -1;
        const handler = getHtmlSerializer(resolve, reject, (name, attribs) => {
            if (name === SAMBAL_SLOT_NAME) {
                slotIndex++;
                return slots[slotIndex].html ? slots[slotIndex].html : "";
            }
            return null;
        }, null);
        const parser = new Parser(handler);
        parser.write(srcHtml);
        parser.end();
    });
}

function getHtmlSerializer(
    resolve,
    reject,
    replace: (name: string, attribs: HtmlAttributes) => string,
    editAttribs: (name: string, attribs: HtmlAttributes) => HtmlAttributes) {
    const stack: string[] = [];
    let html = '';
    let deleteTag: string = null; 
    const handler: Partial<Handler> = {
        onopentag: (name,  attribs) => {
            stack.unshift(name);
            if (deleteTag != null) {
                return;
            }
            const replaceHtml = replace ? replace(name, attribs) : null;
            if (replaceHtml !== null) {
                deleteTag = name;
                html += replaceHtml;
            } else {
                const updatedAttribs = editAttribs ? editAttribs(name, attribs) : attribs;
                html += addOpeningTag(0, name, updatedAttribs);
            }
            
        },
        ontext:(data) => {
            if (deleteTag !== null) {
                return;
            }
            html += data;
        },
        onclosetag: (name) => {
            const tagName = stack.shift();
            if (deleteTag === tagName) {
                deleteTag = null;
            } else {
                html += addClosingTag(0, name);
            }
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
    return handler;
}

async function searchForSambalSlots(srcHtml: string) {
    return new Promise<any[]>((resolve, reject) => {
        const slots = [];
        const handler: Partial<Handler> = {
            onopentag: (name,  attribs) => {
                if (name === SAMBAL_SLOT_NAME) {
                    slots.push({
                        id: attribs.link
                    });
                }
            },
            onerror: (err) => {
                reject(err);
            },
            onend: () => {
                resolve(slots);
            }
        };
        const parser = new Parser(handler);
        parser.write(srcHtml);
        parser.end();
    });
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
