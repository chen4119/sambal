import shelljs from "shelljs";
import UriResolver from "../src/UriResolver";
import { CACHE_FOLDER } from "../src/helpers/constant";
import { init } from "./setup";

describe("UriResolver", () => {
    let uriResolver: UriResolver;

    beforeEach(async () => {
        const classes = await init();
        uriResolver = classes.uriResolver
    });

    afterEach(async () => {
        shelljs.rm("-rf", CACHE_FOLDER);
    });

    it('get blog1', async () => {
        const result = await uriResolver.resolveUri("/blogs/blog1");
        expect(result).toMatchSnapshot();
    });

    it('hydrate blog1', async () => {
        const result = await uriResolver.hydrateUri("/blogs/blog1");
        expect(result).toMatchSnapshot();
    });

    it('get johnsmith', async () => {
        const result = await uriResolver.resolveUri("/john%20smith");
        expect(result).toMatchSnapshot();
    });

    it('hydrate johnsmith', async () => {
        const result = await uriResolver.hydrateUri("/john%20smith");
        expect(result).toMatchSnapshot();
    });

    it('get image2', async () => {
        const result = await uriResolver.resolveUri("/images/image2");
        expect(result).toMatchSnapshot();
        expect(shelljs.test('-f', `${CACHE_FOLDER}/images/image2.webp`)).toBeTruthy();
        expect(shelljs.test('-f', `${CACHE_FOLDER}/images/image2-50.webp`)).toBeTruthy();
    });

    it('get background', async () => {
        const result = await uriResolver.resolveUri("/background");
        expect(result).toMatchSnapshot();
    });

    it('hydrate background', async () => {
        const result = await uriResolver.hydrateUri("/background");
        expect(result).toMatchSnapshot();
    });

    it('hydrate header', async () => {
        const result = await uriResolver.hydrateUri("/header");
        expect(result).toMatchSnapshot();
    });

    it('get collections/tags', async () => {
        const collection = await uriResolver.resolveUri("/collections/tags?tag=java%20script");
        expect(collection["@id"]).toBe("/collections/tags/_part/tag=java%20script");
        expect(collection.itemListElement.length).toBe(2);
    });

    it('get collections/tags as nav', async () => {
        const collection = await uriResolver.resolveUri("/collections/tags?tag=java%20script&output=sitenav");
        expect(collection[0].url).toBe("/blogs/blog1");
        expect(collection[1].url).toBe("/blogs/blog2");
    });

    it('get collections/images', async () => {
        const collection = await uriResolver.resolveUri("/collections/images");
        expect(collection.itemListElement[0].contentUrl).toBe("/images/image2.webp");
    });

    describe("Custom resolver", () => {
        const exampleBlog = {
            "@type": "BlogPost",
            "text": "hello world"
        };

        const exampleResolver = {
            resolveUri: async (uri) => {
                return exampleBlog;
            }
        }

        beforeEach(() => {
            uriResolver.addResolver({host: "example.com"}, {
                resolveUri: exampleResolver.resolveUri,
                clearCache: () => {}
            });
        });

        it('get example.com/blog1', async () => {
            const result = await uriResolver.resolveUri("https://example.com/blog1");
            expect(result).toStrictEqual(exampleBlog);
        });
    });
});