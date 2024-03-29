import axios, { AxiosResponse } from "axios";
import yaml from "js-yaml";
// import marked from "marked";
import glob from "glob";
import {
    getAbsFilePath,
    isValidRelativePath,
    readFileAsBuffer,
    readTextFile,
    frontMatter,
    safeParseJson,
    getFileExt
} from "./util";
import { isAbsUri } from "sambal-jsonld";

enum SUPPORTED_CONTENT_TYPE {
    yaml,
    markdown,
    json,
    image
}

export function searchFiles(query: string | string[]): string[] {
    if (Array.isArray(query)) {
        const matchSet = query.reduce((accumulator, value) => {
            searchFiles(value).forEach(m => accumulator.add(m));
            return accumulator;
        }, new Set<string>());
        return Array.from(matchSet);
    }
    if (isAbsUri(query)) {
        return [query];
    }
    const matches = glob.sync(query);
    return matches.filter(m => isValidRelativePath(m));
}

export function inferUrl(uri: string) {
    if (!uri || typeof(uri) !== "string") {
        return "";
    }
    if (uri.startsWith("/pages")) {
        let url = uri.substring(6);
        if (isSupportedFile(url)) {
            url = url.substring(0, url.lastIndexOf("."));
        }
        if (url === "/index") {
            return "/";
        }
        if (url.endsWith("/index")) {
            url = url.substring(0, url.length - 6);
        }
        return url;
    }
    return uri;
}

export async function loadLocalFile(src: string) {
    if (!isSupportedFile(src)) {
        throw new Error(`Unsupported file type: ${src}`);
    }

    const contentType = getLocalFileContentType(src);
    let content;
    if (contentType === SUPPORTED_CONTENT_TYPE.image) {
        content = await readFileAsBuffer(getAbsFilePath(src));
    } else {
        content = await readTextFile(getAbsFilePath(src));
    }
    return parseContent(content, contentType);
}

export async function loadRemoteFile(src: string) {
    try {
        const response = parseAxiosResponse(await axios.get(src, {
            responseType: 'arraybuffer'
        }));
        return parseContent(response.data, response.supportedType);
    } catch (e) {
        throw `Unable to fetch ${src}. code: ${(e as any).response.status}`;
    }
}

function parseAxiosResponse(response: AxiosResponse<any>): {data: any, supportedType: SUPPORTED_CONTENT_TYPE} {
    const contentType = response.headers["content-type"];
    if (!contentType) {
        throw `Unsupported content type ${contentType}`;
    }
    let data = null;
    let supportedType: SUPPORTED_CONTENT_TYPE = null;
    switch (contentType) {
        case "text/yaml":
        case "text/yml":
        case "application/yaml":
        case "application/yml":
            data = response.data.toString("utf-8");
            supportedType = SUPPORTED_CONTENT_TYPE.yaml;
            break;
        case "application/json":
        case "application/ld+json":
            data = response.data.toString("utf-8");
            supportedType = SUPPORTED_CONTENT_TYPE.json;
            break;
        case "text/markdown":
            data = response.data.toString("utf-8");
            supportedType = SUPPORTED_CONTENT_TYPE.markdown;
            break;
        case "image/jpeg":
        case "image/webp":
        case "image/gif":
        case "image/png":
            data = response.data;
            supportedType = SUPPORTED_CONTENT_TYPE.image;
            break;
        default:
            throw `Unsupported content type ${contentType}`;
    }
    return {
        data,
        supportedType
    };
}

const IMAGE_EXT_REGEX = /.+(.jpg|.jpeg|.gif|.png|.webp)$/i;
const SUPPORTED_FILE_EXT_REGEX = /.+(.yaml|.yml|.json|.md)$/i;

function isImageFile(src: string) {
    if (!src) {
        return false;
    }
    return src.match(IMAGE_EXT_REGEX);
}

export function isSupportedFile(src: string) {
    if (!src) {
        return false;
    }
    return isAbsUri(src) || 
    isImageFile(src) ||
    src.match(SUPPORTED_FILE_EXT_REGEX);
}

function getLocalFileContentType(src: string): SUPPORTED_CONTENT_TYPE {
    const ext = getFileExt(src);
    switch (ext) {
        case "yaml":
        case "yml":
            return SUPPORTED_CONTENT_TYPE.yaml;
        case "json":
            return SUPPORTED_CONTENT_TYPE.json;
        case "md":
            return SUPPORTED_CONTENT_TYPE.markdown;
        case "jpg":
        case "jpeg":
        case "webp":
        case "gif":
        case "png":
            return SUPPORTED_CONTENT_TYPE.image;
        default:
            throw `Unsupported file type with extension ${ext}`;
    }
}

// TODO: ensure markdown is only for creative work!
function parseContent(content: any, contentType: SUPPORTED_CONTENT_TYPE) {
    try {
        let md;
        switch (contentType) {
            case SUPPORTED_CONTENT_TYPE.yaml:
                return yaml.load(content);
            case SUPPORTED_CONTENT_TYPE.json:
                return typeof(content) === "string" ? safeParseJson(content) : content;
            case SUPPORTED_CONTENT_TYPE.markdown:
                md = frontMatter(content);
                return {
                    ...md.frontMatter ? yaml.load(md.frontMatter) as object : {},
                    text: md.content,
                    encodingFormat: "text/markdown"
                }
            case SUPPORTED_CONTENT_TYPE.image:
                return content;
                // return Buffer.from(content, 'binary');
            default:
                throw `Unsupported content type ${contentType}.  Expecting yaml, json or markdown`;
        }
    } catch (e) {
        throw `Unable to parse content: ${e}`;
    }
}