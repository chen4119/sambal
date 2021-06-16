import {
    serializeJsonLd,
    renderSocialMediaMetaTags
} from "../../src/helpers/seo";


describe("seo", () => {
    const baseUrl = "https://example.com";
    const article = {
        "@type": "Article",
        name: "name field",
        headline: "Title of my article",
        description: "Description about my article",
        mainEntityOfPage: "/article",
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

    describe("serializeJsonLd", () => {
        it('article', () => {
            const result = serializeJsonLd(article);
            expect(result).toMatchSnapshot();
        });
    });

    describe("renderSocialMediaMetaTags", () => {
        it('article', async () => {
            const result = await renderSocialMediaMetaTags(baseUrl, article);
            expect(result).toMatchSnapshot();
        });
    });

});