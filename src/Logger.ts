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

    info(message: string) {
        console.log(this.getPrefix(LEVEL_INFO) + message);
    }

    warn(message: string) {
        console.log(this.getPrefix(LEVEL_WARNING) + message);
    }

    error(message: string) {
        console.log(this.getPrefix(LEVEL_ERROR) + message);
    }

    debug(message: string) {
        if (this.options.verbose) {
            console.log(this.getPrefix(LEVEL_DEBUG) + message);
        }
    }

}

export default Logger;