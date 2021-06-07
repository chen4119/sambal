import shelljs from "shelljs";
import axios, { AxiosResponse } from "axios";
import yaml from "js-yaml";
// import marked from "marked";
import glob from "glob";
import {
    getAbsFilePath,
    readFileAsBuffer,
    readTextFile,
    frontMatter,
    safeParseJson,
    getPathnameAndQuery,
    getFileExt
} from "./util";
import { MOUNT_FILE, PAGE_FILE } from "./constant";

enum SUPPORTED_CONTENT_TYPE {
    yaml,
    markdown,
    json,
    image
}

export function searchFiles(baseFolder: string, query: string | string[], allFiles: boolean = false): string[] {
    if (Array.isArray(query)) {
        const matchSet = query.reduce((accumulator, value) => {
            searchFiles(baseFolder, value).forEach(m => accumulator.add(m));
            return accumulator;
        }, new Set<string>());
        return Array.from(matchSet);
    }

    if (isExternalSource(query)) {
        return [query];
    }
    const matches = glob.sync(query, {
        cwd: `${process.cwd()}/${baseFolder}`
    });
    return matches
        .filter(m => (allFiles || !isSambalReservedFile(m)) &&
        isDataFileExist(baseFolder, m));
}

function isSambalReservedFile(filePath: string) {
    return filePath.endsWith(MOUNT_FILE) || filePath.endsWith(PAGE_FILE);
}

export function normalizeRelativePath(src: string) {
    if (isExternalSource(src)) {
        return encodeURI(src);
    }
    let normalSrc = src;
    if (normalSrc.endsWith("/")) {
        normalSrc = normalSrc.substring(0, normalSrc.length - 1);
    }
    if (!normalSrc.startsWith("/")) {
        normalSrc = `/${normalSrc}`;
    }
    return normalSrc;
}

export function normalizeJsonLdId(src: string) {
    if (isExternalSource(src)) {
        return encodeURI(src);
    }

    const pathAndQuery = getPathnameAndQuery(src);
    let normalSrc = normalizeRelativePath(pathAndQuery.pathname);
    if (isSupportedFile(normalSrc)) {
        normalSrc = normalSrc.substring(0, normalSrc.lastIndexOf("."));
    }
    if (normalSrc === "/index") {
        return "/";
    }
    if (normalSrc.endsWith("/index")) {
        normalSrc = normalSrc.substring(0, normalSrc.length - 6);
    }
    return `${encodeURI(normalSrc)}${pathAndQuery.query ? `?${pathAndQuery.query.toString()}` : ""}`;
}

function isDataFileExist(baseFolder: string, filePath: string) {
    return shelljs.test('-f', getAbsFilePath(`${baseFolder}/${filePath}`));
}

export async function loadLocalFile(src: string) {
    if (!isSupportedFile(src)) {
        throw new Error(`Unsupported file type: ${src}`);
    }

    const contentType = getLocalFileContentType(src);
    let content;
    if (contentType === SUPPORTED_CONTENT_TYPE.image) {
        content = await readFileAsBuffer(`${process.cwd()}/${src}`);
    } else {
        content = await readTextFile(`${process.cwd()}/${src}`);
    }
    return parseContent(content, contentType);
}

export async function loadRemoteFile(src: string) {
    const response = await axios.get(src);
    return parseContent(response.data, getAxiosResponseContentType(response));
}

export function isExternalSource(src: string) {
    return src.startsWith("http://") || src.startsWith("https://");
}

const IMAGE_EXT_REGEX = /.+(.jpg|.jpeg|.gif|.png|.webp)$/i;
const SUPPORTED_FILE_EXT_REGEX = /.+(.yaml|.yml|.json|.md)$/i;

export function isImageFile(src: string) {
    if (!src) {
        return false;
    }
    return src.match(IMAGE_EXT_REGEX);
}

export function isSupportedFile(src: string) {
    if (!src) {
        return false;
    }
    return isExternalSource(src) || 
    isImageFile(src) ||
    src.match(SUPPORTED_FILE_EXT_REGEX);
}

// TODO: what about image type?
function getAxiosResponseContentType(response: AxiosResponse<any>): SUPPORTED_CONTENT_TYPE {
    const contentType = response.headers["content-type"];
    if (contentType) {
        if (contentType === "application/json" || contentType === "application/ld+json") {
            return SUPPORTED_CONTENT_TYPE.json;
        }
    }
    throw `Unsupported content type ${contentType}`;
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
                return safeParseJson(content);
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