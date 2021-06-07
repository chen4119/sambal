import shelljs from "shelljs";
import UriResolver from "../src/UriResolver";
import { CACHE_FOLDER, Collection } from "../src/helpers/constant";
import { init } from "./setup";

describe("UriResolver", () => {
    let uriResolver: UriResolver;

    const collections: Collection[] = [
        {
            uri: "/collections/tags",
            match: ["/blogs/**/*"],
            groupBy: (mainEntity) => {
                return mainEntity.keywords.map(tag => ({
                    tag: tag
                }));
            },
            sort: (a, b) => {
                return a.position - b.position;
            }
        },
        {
            uri: "/collections/year",
            match: ["/blogs/**/*"],
            groupBy: (mainEntity) => {
                return {
                    year: mainEntity.dateCreated.getFullYear()
                }
            },
            sort: (a, b) => {
                return a.dateModified.getTime() - b.dateModified.getTime();
            }
        }
    ];

    beforeEach(async () => {
        const classes = await init();
        uriResolver = classes.uriResolver
    });

    afterEach(async () => {
        shelljs.rm("-rf", CACHE_FOLDER);
    });

    it('get blog1', async () => {
        const result = await uriResolver.resolveUri("blogs/blog1");
        expect(result).toMatchSnapshot();
    });

    it('hydrate blog1', async () => {
        const result = await uriResolver.hydrateUri("blogs/blog1");
        expect(result).toMatchSnapshot();
    });

    it('get johnsmith', async () => {
        const result = await uriResolver.resolveUri("/johnsmith");
        expect(result).toMatchSnapshot();
    });

    it('get image2', async () => {
        const result = await uriResolver.resolveUri("images/image2");
        expect(result).toMatchSnapshot();
        expect(shelljs.test('-f', `${CACHE_FOLDER}/images/image2.webp`)).toBeTruthy();
        expect(shelljs.test('-f', `${CACHE_FOLDER}/images/image2-50.webp`)).toBeTruthy();
    });

    it('get background', async () => {
        const result = await uriResolver.resolveUri("background");
        expect(result).toMatchSnapshot();
    });

    it('hydrate background', async () => {
        const result = await uriResolver.hydrateUri("background");
        expect(result).toMatchSnapshot();
    });

    it('hydrate header', async () => {
        const result = await uriResolver.hydrateUri("header");
        expect(result).toMatchSnapshot();
    });

    it('get collections/tags', async () => {
        const collection = await uriResolver.resolveUri("collections/tags?tag=java%20script");
        expect(collection["@id"]).toBe("/collections/tags/_part/tag=java%20script");
        expect(collection.itemListElement.length).toBe(2);
    });

    it('get collections/tags as nav', async () => {
        const collection = await uriResolver.resolveUri("collections/tags?tag=java%20script&output=sitenav");
        expect(collection[0].url).toBe("/blogs/blog1");
        expect(collection[1].url).toBe("/blogs/blog2");
    });


});