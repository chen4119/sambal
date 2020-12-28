import chalk from "chalk";
import { isObjectLiteral } from "./utils";

const LEVEL_INFO = "info";
const LEVEL_WARNING = "warn";
const LEVEL_ERROR = "error";
const LEVEL_DEBUG = "debug";

type LogOptions = {
    name?: string,
    verbose?: boolean
};

const DEFAULT_OPTIONS: LogOptions = {
    verbose: true
};

class Logger {
    constructor(private options: LogOptions = DEFAULT_OPTIONS) {
        
    }

    private getPrefix(level: string) {
        const prefix = this.options.name ? this.options.name : "";
        switch(level) {
            case LEVEL_INFO:
                return chalk.green(prefix);
            case LEVEL_WARNING:
                return chalk.yellow(prefix);
            case LEVEL_ERROR:
                return chalk.red(prefix);
            case LEVEL_DEBUG:
                return chalk.magenta(prefix);
            default:
                return prefix;
        }
    }

    private getMessageType(message:unknown) {
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

    private logToConsole(level: string, message: unknown, ...args) {
        if (args.length > 0 && typeof(message) === "string") {
            const template = `%s - ${message}`;
            console[level](template, this.getPrefix(level), ...args);
        } else {
            console[level](`%s - ${this.getMessageType(message)}`, this.getPrefix(level), message);
        }
    }

    info(message: unknown, ...args) {
        this.logToConsole(LEVEL_INFO, message, ...args);
    }

    warn(message: unknown, ...args) {
        this.logToConsole(LEVEL_WARNING, message, ...args);
    }

    error(message: unknown, ...args) {
        this.logToConsole(LEVEL_ERROR, message, ...args);
    }

    debug(message: unknown, ...args) {
        if (this.options.verbose) {
            this.logToConsole(LEVEL_DEBUG, message, ...args);
        }
    }

}

export default Logger;