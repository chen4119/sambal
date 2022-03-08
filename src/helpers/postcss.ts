import { AcceptedPlugin } from "postcss";
import { dirname, join, basename, extname } from "path";
import { readFileSync, writeFileSync } from "fs";
import shelljs from "shelljs";
import { getAbsFilePath, hashContent } from "./util";

const URL_REGEX = /url\(\s*['"]?([^"')]+)["']?\s*\)/g;

const PLUGIN_NAME = "sambal";
const processed = Symbol('processed');


export function postcssPlugin(assetMap: Map<string, string>): AcceptedPlugin {
    return {
        postcssPlugin: PLUGIN_NAME,
        Declaration: (decl, { result }) => {
            if (!decl[processed] && URL_REGEX.test(decl.value)) {
                decl.value = decl.value.replace(URL_REGEX, (match, filePath, offset, str) => {
                    const sourceFile = join(process.cwd(), dirname(result.opts.from), filePath);
                    if (!assetMap.has(sourceFile)) {
                        const content = readFileSync(sourceFile);
                        const hash = hashContent(content);
                        const destFilename = `${basename(filePath, extname(filePath))}.${hash}${extname(filePath)}`;
                        const destFile = join(dirname(result.opts.from), dirname(filePath), destFilename);
                        const absDestFile = getAbsFilePath(join(result.opts.to, destFile));
                        shelljs.mkdir("-p", dirname(absDestFile));
                        writeFileSync(absDestFile, content);
                        assetMap.set(sourceFile, join(dirname(filePath), destFilename));
                    }
                    return `url('${assetMap.get(sourceFile)}')`;
                });
                decl[processed] = true;
            }
        }
    }
}