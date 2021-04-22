import fs from "fs";
import path from "path";
import shelljs from "shelljs";
import { JSONLD_ID } from "sambal-jsonld";

export function isObjectLiteral(obj) {
    return obj !== null && typeof(obj) === "object" && Object.getPrototypeOf(obj) === Object.prototype;
}

export function isJsDate(value) {
    return typeof(value) === "object" && Object.getPrototypeOf(value) === Date.prototype;
}

export function isNullOrUndefined(val: any) {
    return typeof(val) === "undefined" || val === null;
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

export function getMimeType(filePath: string) {
    const ext = path.extname(filePath);
    switch(ext) {
        case ".js":
        case ".mjs":
            return "text/javascript";
        case ".ico":
            return "image/vnd.microsoft.icon";
        case ".css":
            return "text/css";
        case ".woff":
        case ".woff2":
            return `font/${ext}`;
        case ".svg":
            return "image/svg+xml";
        default:
            throw new Error(`Unrecognized mime type for file ${filePath}`);
    }
}

export function safeParseJson(jsonStr: string) {
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        return {};
    }
}

export function formatSize(size) {
    const base = Math.floor( Math.log(size) / Math.log(1024) );
    return `${Math.floor(size / Math.pow(1024, base))} ${['B', 'kB', 'MB', 'GB', 'TB'][base]}`;
}

// const FRONT_MATTER_REGEX = /---(.+)---(.+)/s
export function frontMatter(md: string) {
    const splitted = md.split("---");
    if (splitted.length >= 1) {
        return {
            frontMatter: splitted[1],
            content: splitted.slice(2).join("")
        };
    }
    return {
        content: md
    }
}

/*
export async function traverseSiteGraph(root: PageNode, callback: (page: PageNode) => void | Promise<void>) {
    await callback(root);
    for (const child of root.hasPart) {
        await traverseSiteGraph(child, callback);
    }
}*/