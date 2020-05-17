import {of, from} from "rxjs";
import {template} from "../../src/template";
import {loadJsonLd} from "../../src/operators/loadJsonLd";
import {render} from "../../src/operators/render";
import {toHtml} from "../../src/operators/toHtml";
import {pushJsonLd} from "../../src/operators/pushJsonLd";
import {toSchemaOrgJsonLd} from "sambal-jsonld";

describe('toHtml', () => {
    it('add css to head', async () => {
        const result = await of({text: "hello world"})
        .pipe(render(({css, text}) => {
            const classes = css.style({
                main: {
                    "font-style": "italic"
                }
            });
            return template`
                <!doctype html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                    </head>
                    <body>
                        ${template`
                            <main class=${classes.main}>
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

    it('add schema.org to head', async () => {
        const result = await from(['tests/post.md'])
        .pipe(loadJsonLd())
        .pipe(pushJsonLd(d => toSchemaOrgJsonLd(d, "BlogPosting")))
        .pipe(render(({text}) => {
            return template`
                <!doctype html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                    </head>
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

    it('automatically add head if not found', async () => {
        const result = await of({text: "hello world"})
        .pipe(render(({css, text}) => {
            const classes = css.style({
                main: {
                    "font-style": "italic"
                }
            });
            return template`
                <!doctype html>
                <html>
                    <body>
                        ${template`
                            <main class=${classes.main}>
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

    it('replace img', async () => {
        const result = await of({text: "hello world"})
        .pipe(render(({css, text}) => {
            const classes = css.style({
                main: {
                    "font-style": "italic"
                }
            });
            return template`
                <!doctype html>
                <html>
                    <body>
                        ${template`
                            <main class=${classes.main}>
                                ${text}
                            <img src="/img1.png">
                            </main>
                        `}
                    </body>
                </html>
            `;
        }))
        .pipe(toHtml({
            replace: (name, attribs) => {
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
            }
        }))
        .toPromise();
        expect(result).toMatchSnapshot();
    });
})