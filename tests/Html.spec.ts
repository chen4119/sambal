import { WebPage } from "../src/helpers/constant";
import Html from "../src/Html";


describe("Html", () => {

    const person = {
        "@type": "BlogPosting",
        name: "John Smith <h1>Random html</h1>",
        familyName: "Smith",
        givenName: "John"
    };

    it("get jsSources", () => {
        const html = `
            <html>
                <head>
                    <script src="/theme/index.js"></script>
                </head>
                <body>
                    <h1>hello world</h1>
                    <script src="index2.js"></script>
                </body>
            </html>
        `;

        const instance = new Html(html);
        expect(instance.jsSources).toStrictEqual(["/theme/index.js", "index2.js"]);
    });

    it("replaceJsScriptSrc", () => {
        const html = `
            <html>
                <head>
                    <script src="/theme/index.js"></script>
                </head>
                <body>
                    <h1>hello world</h1>
                    <script src="index2.js"></script>
                </body>
            </html>
        `;

        const instance = new Html(html);
        instance.replaceJsScriptSrc("/theme/index.js", "/theme/changed.js");
        expect(instance.serialize()).toMatchSnapshot();
    });

    describe("addSchemaJsonLd", () => {
        it("add ld+jsonld script", () => {
            const html = `
                <html>
                    <head>
                        <script src="/theme/index.js"></script>
                    </head>
                    <body>
                        <h1>hello world</h1>
                    </body>
                </html>
            `;
    
            const instance = new Html(html);
            expect(instance.hasJsonLd).toBeFalsy();
            instance.addSchemaJsonLd(person);
            expect(instance.serialize()).toMatchSnapshot();
        });

        it("replace existing ld+jsonld script", () => {
            const html = `
                <html>
                    <head>
                        <script type="application/ld+json">
                            testing
                        </script>
                    </head>
                    <body>
                        <h1>hello world</h1>
                    </body>
                </html>
            `;
    
            const instance = new Html(html);
            expect(instance.hasJsonLd).toBeTruthy();
            instance.addSchemaJsonLd(person);
            expect(instance.serialize()).toMatchSnapshot();
        });  
    });
    
    describe("addMetaTags", () => {
        const baseUrl = "https://example.com";
        const article = {
            "@type": "Article",
            name: "name field",
            headline: "Title of my article",
            description: "Description about my article",
            text: "<have some characters to <escape>>",
            image: {
                "@type": "ImageObject",
                contentSize: "1 kB",
                contentUrl: "/images/image2-50.webp",
                encodingFormat: "image/webp",
                height: 50,
                width: 75
            }
        };
        const page: WebPage = {
            "@type": "WebPage",
            url: "/article",
            mainEntity: article,
            mainEntityOfPage: "/article"
        }

        it("add canonical url, title and description", () => {
            const html = `
                <html>
                    <head>
                        
                    </head>
                    <body>
                        <h1>hello world</h1>
                    </body>
                </html>
            `;
            const instance = new Html(html);
            instance.addMetaTags(baseUrl, page);
            expect(instance.serialize()).toMatchSnapshot();
        });

        
    
    });


});