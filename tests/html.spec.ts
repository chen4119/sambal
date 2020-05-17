import {from} from "rxjs";
import {template} from "../src/template";
import {loadJsonLd} from "../src/operators/loadJsonLd";
import {render} from "../src/operators/render";
import {toHtml} from "../src/operators/toHtml";
import {prettify, HtmlNode, HtmlAttributes} from "../src/html";

const NOOP_EDIT_ATTRIBS = (name: string, attribs: HtmlAttributes) => attribs;
const NOOP_PREPEND = (name: string, attribs: HtmlAttributes) => null;
const NOOP_APPEND = (name: string, attribs: HtmlAttributes) => null;
const NOOP_REPLACE = (name: string, attribs: HtmlAttributes) => null;

describe('html', () => {
    const html = `
        <!doctype html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
                <meta http-equiv="X-UA-Compatible" content="ie=edge">
                <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
                <base href="/">
                <script src="./js/index.js"></script>
            </head>
            <body>
                <main>
                    <h1>hello world</h1>

                    <p>My paragraph</p>
                </main>
                <a href="/hfoi">link</a>
                <img href="/image.png">
                <br>

                <br>
            </body>
        </html>
    `;

    it('prettify', async () => {
        const result = await prettify(html, NOOP_EDIT_ATTRIBS, NOOP_PREPEND, NOOP_APPEND, NOOP_REPLACE);
        expect(result).toMatchSnapshot();
    });

    it('change src attrib', async () => {
        const result = await prettify(html, (name, attribs) => {
            if (name === 'script') {
                return {
                    src: 'https://localhost:3000'
                }
            }
            return attribs;
        }, NOOP_PREPEND, NOOP_APPEND, NOOP_REPLACE);
        expect(result).toMatchSnapshot();
    });

    it('replace node', async () => {
        const result = await prettify(html, NOOP_EDIT_ATTRIBS, NOOP_PREPEND, NOOP_APPEND, (name, attribs) => {
            if (name === 'img') {
                return {
                    name: 'picture',
                    body: [
                        {name: 'source', attributes: {media: "(min-width: 480px)", srcset: "img1.jpg"}},
                        {name: 'source', attributes: {media: "(min-width: 650px)", srcset: "img2.jpg"}}
                    ]
                };
            }
            return null;
        });
        expect(result).toMatchSnapshot();
    });

    it('preserve <pre>', async () => {
        const result = await from(['tests/post.md'])
        .pipe(loadJsonLd())
        .pipe(render(({text}) => {
            return template`
                <!doctype html>
                <html>
                    <body>
                        ${template`
                            <main>
                                ${text}
                            </main>
                        `}
                    </body>
                </html>
            `;
        }))
        .pipe(toHtml())
        .toPromise();
        expect(result).toMatchSnapshot();
    });
})