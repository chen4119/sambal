import {
    normalizeJsonLdId
} from "../../src/helpers/data";


describe("data", () => {

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
    });

});