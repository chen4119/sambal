import {
    searchFiles,
    inferUrl
} from "../../src/helpers/data";


describe("data", () => {

    describe("searchFiles", () => {

        it('get all pages', async () => {
            const result = searchFiles("pages/**/*");
            expect(result.length).toBe(7);
        });

        it('return absolute uris', async () => {
            const result = searchFiles(["https://sambal.dev/1", "https://chen4119.me/1"]);
            expect(result).toStrictEqual(["https://sambal.dev/1", "https://chen4119.me/1"]);
        });

    });

    describe("inferUrl", () => {

        it('return /', async () => {
            const result = inferUrl("/pages/index.yml");
            expect(result).toBe("/");
        });

        it('return /blogs/blog1', async () => {
            const result = inferUrl("/pages/blogs/blog1.md");
            expect(result).toBe("/blogs/blog1");
        });

        it('return /data/header.yml', async () => {
            const result = inferUrl("/data/header.yml");
            expect(result).toBe("/data/header.yml");
        });

    });

    /*
    describe("normalizeJsonLdId", () => {

        it('return original id', async () => {
            const result = normalizeJsonLdId("/blogs/blog1");
            expect(result).toBe("/blogs/blog1");
        });

        it('begins with / and remove file extension', async () => {
            const result = normalizeJsonLdId("blogs/blog1.md");
            expect(result).toBe("/blogs/blog1");
        });

        it('cannot end with /', async () => {
            const result = normalizeJsonLdId("blogs/blog1/");
            expect(result).toBe("/blogs/blog1");
        });

        it('encode relative uri', async () => {
            const result = normalizeJsonLdId("/blogs/blog 1");
            expect(result).toBe("/blogs/blog%201");
        });

        it('encode abs uri', async () => {
            const result = normalizeJsonLdId("https://sambal.dev/blogs/blog 1");
            expect(result).toBe("https://sambal.dev/blogs/blog%201");
        });
    });*/

});