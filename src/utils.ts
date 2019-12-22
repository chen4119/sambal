import {
    SUPPORTED_CONTENT_TYPE,
    SUPPORTED_FILE_EXT_REGEX
} from "./constants";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import matter from 'gray-matter';
import marked from "marked";
import axios, { AxiosResponse } from "axios";
import shelljs from "shelljs";

export function queryData(data: any, dataPath: string) {
    const fieldArray = dataPath.split('.');
    let current = data;
    for (let i = 0; i < fieldArray.length; i++) {
        current = current[fieldArray[i]];
    }
    return current;
}

export function setPropAt(data: any, dataPath: string, propValue: any) {
    const fieldArray = dataPath.split('.');
    let current = data;
    for (let i = 0; i < fieldArray.length; i++) {
        if (i !== fieldArray.length - 1) {
            current = current[fieldArray[i]];
        } else {
            current[fieldArray[i]] = propValue;
        }
    }
}

export async function loadContent(src: string) {
    if (isExternalSource(src)) {
        const response = await axios.get(src);
        return parseContent(response.data, getAxiosResponseContentType(response));
    }
    const content = await readFile(src);
    return parseContent(content, getLocalFileContentType(src));
}

export function isObjectLiteral(obj: any) {
    return obj !== null && typeof(obj) === "object" && Object.getPrototypeOf(obj) === Object.prototype;
}

export function isDate(obj: any) {
    return typeof(obj) === "object" && Object.getPrototypeOf(obj) === Date.prototype;
}

export function isNullOrUndefined(val: any) {
    return typeof(val) === "undefined" || val === null;
}

export function isNonEmptyString(val: any) {
    return typeof(val) === "string" && val.length > 0;
}

export function readFile(src: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(src, "utf-8", (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })
    });
}

export function writeFile(output: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
        shelljs.mkdir("-p", path.dirname(output));
        console.log("Writing " + output);
        fs.writeFile(output, content, "utf-8", (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function isExternalSource(src: string) {
    return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//");
}

export function isSupportedFile(src: string) {
    return isExternalSource(src) || (src.match(SUPPORTED_FILE_EXT_REGEX));
}

export function safeParseJson(jsonStr: string) {
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        return {};
    }
}

export function getFullPath(base: string, filePath: string) {
    return path.join(base, filePath);
}

function getAxiosResponseContentType(response: AxiosResponse<any>): SUPPORTED_CONTENT_TYPE {
    const contentType = response.headers['content-type'];
    if (contentType) {
        if (contentType.indexOf("text/html") >= 0) {
            return SUPPORTED_CONTENT_TYPE.html;
        }
    }
    throw `Unsupported content type ${contentType}.  Expecting yaml, json, markdown, or html file type`;
}

function getLocalFileContentType(src: string): SUPPORTED_CONTENT_TYPE {
    const ext = path.extname(src).toLowerCase();
    switch (ext) {
        case ".yaml":
        case ".yml":
            return SUPPORTED_CONTENT_TYPE.yaml;
        case ".json":
            return SUPPORTED_CONTENT_TYPE.json;
        case ".md":
            return SUPPORTED_CONTENT_TYPE.markdown;
        case ".html":
        case ".htm":
            return SUPPORTED_CONTENT_TYPE.html;
        default:
            throw `Unsupported file type with extension ${ext}.  Expecting yaml, json, markdown, or html file type`;
    }
}

function parseContent(content: string, contentType: SUPPORTED_CONTENT_TYPE) {
    try {
        switch (contentType) {
            case SUPPORTED_CONTENT_TYPE.yaml:
                return yaml.safeLoad(content);
            case SUPPORTED_CONTENT_TYPE.json:
                return safeParseJson(content);
            case SUPPORTED_CONTENT_TYPE.markdown:
                const frontMatter = matter(content);
                return {
                    ...frontMatter.data,
                    text: marked(frontMatter.content)
                };
            case SUPPORTED_CONTENT_TYPE.html:
                const $ = cheerio.load(content);
                const scriptSelector = 'script[type="application/ld+json"]';
                const jsonlds = [];
                $(scriptSelector).each(function() {
                    const schemaOrg = safeParseJson($(this).html());
                    jsonlds.push(schemaOrg);
                });
                return jsonlds;
            default:
                throw `Unsupported content type ${contentType}.  Expecting yaml, json or markdown`;
        }
    } catch (e) {
        throw `Unable to parse content: ${e}`;
    }
}
