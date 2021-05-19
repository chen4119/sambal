import shelljs from "shelljs";
import UriResolver from "../src/UriResolver";
import FileSystemResolver from "../src/resolvers/FileSystemResolver";
import HttpResolver from "../src/resolvers/HttpResolver";
import Media from "../src/Media";
import CollectionBuilder from "../src/CollectionBuilder";
import { CACHE_FOLDER } from "../src/helpers/constant";
import Graph from "../src/Graph";

describe("UriResolver", () => {
    let uriResolver: UriResolver;
    const transforms = [
        {
            src: "images/image2.jpg",
            width: 500,
            encodingFormat: "image/webp",
            thumbnails: [
                {
                    name: "image2-50",
                    height: 50
                }
            ]
        }
    ];
    
    const pages = [
        "blogs/blog1.md"
    ];

    const data = [
        "johnsmith.yml",
        "images/image2.jpg"
    ];

    beforeEach(async () => {
        uriResolver = new UriResolver();
        const graph = new Graph(uriResolver);
        const media = new Media(CACHE_FOLDER, transforms);
        const collections = new CollectionBuilder([], graph);
        const fsResolver = new FileSystemResolver(pages, data, media, collections);
        const httpResolver = new HttpResolver(media);
        uriResolver.fsResolver = fsResolver;
        uriResolver.httpResolver = httpResolver;
    });

    afterEach(async () => {
        shelljs.rm("-rf", CACHE_FOLDER);
    });

    it('get blog1', async () => {
        const result = await uriResolver.resolveUri("blogs/blog1");
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

});