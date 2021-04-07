import path from "path";
import shelljs from "shelljs";
import axios, { AxiosResponse } from "axios";
import yaml from "js-yaml";
// import marked from "marked";
import glob from "glob";
import {
    getAbsFilePath,
    readFile,
    readTextFile,
    frontMatter,
    safeParseJson
} from "./util";

enum SUPPORTED_CONTENT_TYPE {
    yaml,
    markdown,
    json,
    image
}

const LINKED_DATA_ROOT_DIR = "content";

const globOption = {
    cwd: `${process.cwd()}/${LINKED_DATA_ROOT_DIR}`
}

export function searchLocalFiles(query: string | string[]): string[] {
    if (Array.isArray(query)) {
        const matchSet = query.reduce((accumulator, value) => {
            searchLocalFiles(value).forEach(m => accumulator.add(m));
            return accumulator;
        }, new Set<string>());
        return Array.from(matchSet);
    }

    if (isExternalSource(query)) {
        return [query];
    }
    const matches = glob.sync(query, globOption);
    return matches
    .filter(m => isDataFileExist(m));

    /*
    .map(m => {
        const basename = path.basename(m);
        const filename = basename.substring(0, basename.lastIndexOf(path.extname(basename)));
        return `${path.dirname(m)}/${filename}`;
    });*/
}

export function normalizeRelativePath(src: string) {
    if (isExternalSource(src)) {
        return src;
    }
    if (!src.startsWith("/")) {
        return `/${src}`;
    }
    return src;
}

export function normalizeJsonLdId(src: string) {
    if (isExternalSource(src)) {
        return src;
    }
    let normalSrc = normalizeRelativePath(src);
    if (isSupportedFile(normalSrc)) {
        normalSrc = normalSrc.substring(0, normalSrc.lastIndexOf("."));
    }
    return encodeURI(normalSrc);
}

export function getLocalFilePath(src: string) {
    const files = glob.sync(`${src}.+(yml|yaml|json|md|jpg|jpeg|gif|png|webp)`, globOption);
    if (files.length === 1 && isDataFileExist(files[0])) {
        return files[0];
    }

    if (files.length === 0) {
        throw new Error(`No file found at ${src}`);
    } else if (files.length > 1) {
        throw new Error(`Ambiguous ${src}, more than one file found ${files}`);
    }
}

function isDataFileExist(filePath: string) {
    return shelljs.test('-f', getAbsFilePath(`${LINKED_DATA_ROOT_DIR}/${filePath}`));
}

export async function loadLocalFile(src: string) {
    if (!isSupportedFile(src)) {
        throw new Error(`Unsupported file type: ${src}`);
    }

    const contentType = getLocalFileContentType(src);
    let content;
    if (contentType === SUPPORTED_CONTENT_TYPE.image) {
        content = await readFile(`${LINKED_DATA_ROOT_DIR}/${src}`);
    } else {
        content = await readTextFile(`${LINKED_DATA_ROOT_DIR}/${src}`);
    }
    return parseContent(content, contentType);
}

export async function loadRemoteFile(src: string) {
    const response = await axios.get(src);
    return parseContent(response.data, getAxiosResponseContentType(response));
}

export function isExternalSource(src: string) {
    return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//");
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
    const ext = path.extname(src).toLowerCase();
    switch (ext) {
        case ".yaml":
        case ".yml":
            return SUPPORTED_CONTENT_TYPE.yaml;
        case ".json":
            return SUPPORTED_CONTENT_TYPE.json;
        case ".md":
            return SUPPORTED_CONTENT_TYPE.markdown;
        case ".jpg":
        case ".jpeg":
        case ".webp":
        case ".gif":
        case ".png":
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
                return Buffer.from(content, 'binary');
            default:
                throw `Unsupported content type ${contentType}.  Expecting yaml, json or markdown`;
        }
    } catch (e) {
        throw `Unable to parse content: ${e}`;
    }
}