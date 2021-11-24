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
        const result = await uriResolver.resolveUri("/pages/blogs/blog1.md");
        expect(result).toMatchSnapshot();
    });

    
    it('hydrate blog1', async () => {
        const result = await uriResolver.hydrateUri("/pages/blogs/blog1.md");
        expect(result).toMatchSnapshot();
    });

    it('get johnsmith', async () => {
        const result = await uriResolver.resolveUri("/data/john smith.yml");
        expect(result).toMatchSnapshot();
    });

    
    it('hydrate johnsmith', async () => {
        const result = await uriResolver.hydrateUri("/data/john smith.yml");
        expect(result).toMatchSnapshot();
    });

    it('get image2', async () => {
        const result = await uriResolver.resolveUri("/data/images/image2.jpg");
        expect(result).toMatchSnapshot();
        expect(shelljs.test('-f', `${CACHE_FOLDER}/data/images/image2.jpg`)).toBeTruthy();
    });

    it('get background', async () => {
        const result = await uriResolver.resolveUri("/data/background.yml");
        expect(result).toMatchSnapshot();
    });

    it('hydrate background', async () => {
        const result = await uriResolver.hydrateUri("/data/background.yml");
        expect(result).toMatchSnapshot();
    });

    it('hydrate header', async () => {
        const result = await uriResolver.hydrateUri("/data/header.yml");
        expect(result).toMatchSnapshot();
    });

    it('get collections/tags', async () => {
        const collection = await uriResolver.resolveUri("/collections/tags?tag=java script");
        expect(collection.length).toBe(2);
        expect(collection).toMatchSnapshot();
    });

    it('get collections/tags as nav', async () => {
        const collection = await uriResolver.resolveUri("/collections/tags?tag=java script&output=sitenav");
        expect(collection[0].url).toBe("/blogs/blog1");
        expect(collection[1].url).toBe("/blogs/blog2");
    });

    it('get collections/images', async () => {
        const collection = await uriResolver.resolveUri("/collections/images");
        expect(collection[0].contentUrl).toBe("/data/images/image2.jpg");
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