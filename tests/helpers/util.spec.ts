import {
    frontMatter
} from "../../src/helpers/util";


describe("util", () => {

    describe("frontMatter", () => {
        const md = `
            ---
            test: hello world
            ---
            body of the markdown
            
            \`\`\`md
                ---
                test: hello world
                ---
                something
            \`\`\`
        `;
        it('return original id', async () => {
            const result = frontMatter(md);
            expect(result).toMatchSnapshot();
        });
    
    });

});