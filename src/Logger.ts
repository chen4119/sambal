import chalk from "chalk";

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
        const prefix = this.options.name ? `${this.options.name}: ` : "";
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

    private stringifyMessage(message: any) {
        if (Array.isArray(message)) {
            return message.map(m => this.stringifyMessage(m));
        } else if (message instanceof Error) {
            return message.stack ? message.stack : message.toString();
        } else if (typeof(message) === "object") {
            return JSON.stringify(message);
        }
        return String(message);
    }

    private logToConsole(level: string, message: any) {
        const stringifyMessage = this.stringifyMessage(message);
        if (Array.isArray(stringifyMessage)) {
            for (const m of stringifyMessage) {
                console[level](this.getPrefix(level) + m);
            }
        } else {
            console[level](this.getPrefix(level) + stringifyMessage);
        }
    }

    info(message: any) {
        this.logToConsole(LEVEL_INFO, message);
    }

    warn(message: any) {
        this.logToConsole(LEVEL_WARNING, message);
    }

    error(message: any) {
        this.logToConsole(LEVEL_ERROR, message);
    }

    debug(message: any) {
        if (this.options.verbose) {
            this.logToConsole(LEVEL_DEBUG, message);
        }
    }

}

export default Logger;