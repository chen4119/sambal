import {
    template
} from "../../src/ui/template";


describe("template", () => {

    it('render array', async () => {
        const listItems = [
            "<li>one</li>",
            "<li>two</li>",
            "<li>three</li>"
        ]
        const html = await template`
            <ul>
                ${listItems}
            </ul>
        `;
        expect(html).toMatchSnapshot();
    });

    it('render nothing for null', async () => {
        const listItems = null;
        const html = await template`
            <ul>
                ${listItems}
            </ul>
        `;
        expect(html).toMatchSnapshot();
    });

    it('render async', async () => {
        const renderItem = async () => template`<li>two</li>`;
        const html = await template`
            <ul>
                ${renderItem()}
            </ul>
        `;
        expect(html).toMatchSnapshot();
    });

    it('nested template', async () => {
        const itemFragment = template`
            <li>
                <b>Hello world</b>
            </li>
        `;

        const html = await template`
            <ul>
                ${itemFragment}
            </ul>
        `;

        console.log(html);
    });

});