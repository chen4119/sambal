import Logger from "../src/Logger";

describe("Logger", () => {

    let logger: Logger = new Logger({name: "Unit testing"});

    it("Log message", () => {
        logger.info("hello world");
    });

    it("Log number as arg", () => {
        logger.info("%i dogs", 3);
    });

    it("Log json as arg", () => {
        logger.info("JSON: %j", {
            name: "John Doe",
            keywords: ["tag1", "tag2"]
        });
    });

    it("Log json", () => {
        logger.info({
            name: "John Doe",
            keywords: ["tag1", "tag2"]
        });
    });

    it("Log error", () => {
        logger.error(new Error("this is an error"));
    });


});