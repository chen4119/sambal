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

        it('encode uri', async () => {
            const result = normalizeJsonLdId("/blogs/blog 1");
            expect(result).toBe("/blogs/blog%201");
        });
    });

});