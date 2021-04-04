import chalk from "chalk";
import { isObjectLiteral } from "./util";

const LEVEL_INFO = "info";
const LEVEL_WARNING = "warn";
const LEVEL_ERROR = "error";
const LEVEL_DEBUG = "debug";

function getPrefix(level: string) {
    switch(level) {
        case LEVEL_INFO:
            return chalk.green("Info");
        case LEVEL_WARNING:
            return chalk.yellow("Warning");
        case LEVEL_ERROR:
            return chalk.red("Error");
        case LEVEL_DEBUG:
            return chalk.magenta("Debug");
        default:
            return "";
    }
}

function getMessageType(message:unknown) {
    if (Number.isInteger(message)) {
        return "%i";
    } else if (typeof(message) === "number") {
        return "%f";
    } else if (isObjectLiteral(message)) {
        return "%j"; // json
    } else if (typeof(message) === "object") {
        return "%O";
    }
    return "%s"; // string
}

function logToConsole(level: string, message: unknown, ...args) {
    if (args.length > 0 && typeof(message) === "string") {
        const template = `%s - ${message}`;
        console[level](template, getPrefix(level), ...args);
    } else {
        console[level](`%s - ${getMessageType(message)}`, getPrefix(level), message);
    }
}

let verbose = true;
export const log = {
    info: (message: unknown, ...args) => {
        logToConsole(LEVEL_INFO, message, ...args);
    },
    warn: (message: unknown, ...args) => {
        logToConsole(LEVEL_WARNING, message, ...args);
    },
    error: (message: unknown, ...args) => {
        logToConsole(LEVEL_ERROR, message, ...args);
    },
    debug: (message: unknown, ...args) => {
        if (verbose) {
            logToConsole(LEVEL_DEBUG, message, ...args);
        }
    },
    setVerbose: (flag) => {
        verbose = flag;
    }
}
