import fs from "fs";
import path from "path";
import crypto from "crypto";
import { isAbsUri } from "sambal-jsonld";
import shelljs from "shelljs";

export function isObjectLiteral(obj: unknown) {
    return obj !== null && typeof(obj) === "object" && Object.getPrototypeOf(obj) === Object.prototype;
}

export function isJsDate(value: any) {
    return typeof(value) === "object" && Object.getPrototypeOf(value) === Date.prototype;
}

export function deepClone(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(d => deepClone(d));
    } else if (isObjectLiteral(obj)) {
        const newObj: any = {};
        for (const fieldName of Object.keys(obj)) {
            const value = obj[fieldName];
            newObj[fieldName] = deepClone(value);
        }
        return newObj;
    }
    return obj;
}

export function hashContent(content: string | Buffer) {
    const md5 = crypto.createHash("sha1");
    md5.update(content);
    return md5.digest('hex');
}

export function normalizeUri(uri: string) {
    if (isAbsUri(uri)) {
        return uri;
    }

    // uri assumed to be relative
    if (uri.startsWith("./") || uri.startsWith("../")) {
        throw new Error (`Relative path needs to start with "/", relative to root project folder`);
    }
    if (!uri.startsWith("/")) {
        return `/${uri}`;
    }
    return uri;
}

/*
export function isNullOrUndefined(val: any) {
    return typeof(val) === "undefined" || val === null;
}*/

export function isValidRelativePath(filePath: string) {
    return shelljs.test('-f', getAbsFilePath(filePath));
}

export function getAbsFilePath(src: string) {
    return path.normalize(`${process.cwd()}/${src}`);
}

export function readTextFile(src: string): Promise<string> {
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

export function readFileAsBuffer(src: string): Promise<any> {
    return new Promise((resolve, reject) => {
        fs.readFile(src, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })
    });
}

export function writeText(output: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
        shelljs.mkdir("-p", path.dirname(output));
        fs.writeFile(output, content, "utf-8", (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function writeBuffer(output: string, content: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
        shelljs.mkdir("-p", path.dirname(output));
        fs.writeFile(output, content, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function getFileExt(filePath: string) {
    const index = filePath.lastIndexOf(".");
    if (index >= 0 && index < filePath.length - 1) {
        return filePath.substring(index + 1).toLowerCase();
    }
    return "";
}

export function getMimeType(ext: string) {
    switch(ext) {
        case "js":
        case "mjs":
            return "text/javascript";
        case "ico":
            return "image/vnd.microsoft.icon";
        case "css":
            return `text/${ext}`;
        case "woff":
        case "woff2":
            return `font/${ext}`;
        case "jpg":
            return "image/jpeg";
        case "jpeg":
        case "webp":
        case "gif":
        case "png":
            return `image/${ext}`;
        case "svg":
            return "image/svg+xml";
        default:
            return null;
    }
}

export function safeParseJson(jsonStr: string) {
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        return {};
    }
}

export function formatSize(size: number) {
    const base = Math.floor( Math.log(size) / Math.log(1024) );
    return `${Math.floor(size / Math.pow(1024, base))} ${['B', 'kB', 'MB', 'GB', 'TB'][base]}`;
}

export function frontMatter(md: string) {
    const splitted = md.split("---");
    if (splitted.length >= 1) {
        return {
            frontMatter: splitted[1],
            content: splitted.slice(2).join("---")
        };
    }
    return {
        content: md
    }
}
