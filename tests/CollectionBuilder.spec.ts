import CollectionBuilder from "../src/CollectionBuilder";
import Graph from "../src/Graph";
import Media from "../src/Media";
import UriResolver from "../src/UriResolver";
import FileSystemResolver from "../src/resolvers/FileSystemResolver";
import HttpResolver from "../src/resolvers/HttpResolver";
import { CACHE_FOLDER, PAGES_FOLDER, DATA_FOLDER, Collection, URI, FS_PROTO, LOCALHOST } from "../src/helpers/constant";
import { searchFiles } from "../src/helpers/data";
import { URLSearchParams } from "url";

describe("CollectionBuilder", () => {
    const baseUrl = "https://example.com";
    let collectionBuilder: CollectionBuilder;

    const pages = searchFiles(PAGES_FOLDER, "**/*", true);
    const data = searchFiles(DATA_FOLDER, "**/*", true);
    
    const collections: Collection[] = [
        {
            uri: "collections/tags",
            src: ["blogs/**/*"],
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
            uri: "collections/year",
            src: ["blogs/**/*"],
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
        const uriResolver = new UriResolver();
        const graph = new Graph(uriResolver);
        const media = new Media(CACHE_FOLDER, []);
        collectionBuilder = new CollectionBuilder(collections, graph);
        const fsResolver = new FileSystemResolver(pages, data, media, collectionBuilder);
        const httpResolver = new HttpResolver(media);
        uriResolver.fsResolver = fsResolver;
        uriResolver.httpResolver = httpResolver;
    });

    it('get collections/tags pages', async () => {
        const partitions = await collectionBuilder.getCollectionPages("collections/tags", 100);
        expect(partitions.length).toBe(3);
    });

    it('get collections/year pages', async () => {
        const partitions = await collectionBuilder.getCollectionPages("collections/year", 100);
        expect(partitions.length).toBe(2);
    });

    it('get javascript tag pages', async () => {
        const partitionKey = {tag: 'java script'};
        const partition = await collectionBuilder.getPartitionPages("collections/tags", partitionKey, 100);
        expect(partition.pages.length).toBe(1);
        const itemList = partition.pages[0].item;
        expect(itemList.itemListElement.length).toBe(2);
    });


    it('queryCollection by year', async () => {
        const uri:URI = {
            protocol: FS_PROTO,
            host: LOCALHOST,
            path: "/collections/year",
            query: new URLSearchParams("?year=2019")
        }
        const collection: any = await collectionBuilder.queryCollection(uri);
        expect(collection["@id"]).toBe("/collections/year/_part/year=2019");
        expect(collection.itemListElement[0]["@id"]).toBe("/blogs/blog1");
    });

    it('queryCollection by tag', async () => {
        const uri:URI = {
            protocol: FS_PROTO,
            host: LOCALHOST,
            path: "/collections/tags",
            query: new URLSearchParams("?tag=java script")
        }
        const collection: any = await collectionBuilder.queryCollection(uri);
        expect(collection["@id"]).toBe("/collections/tags/_part/tag=java%20script");
        expect(collection.itemListElement.length).toBe(2);
    });

});