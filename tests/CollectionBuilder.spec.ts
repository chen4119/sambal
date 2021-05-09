import CollectionBuilder from "../src/CollectionBuilder";
import Graph from "../src/Graph";
import Media from "../src/Media";
import Links from "../src/Links";
import { CACHE_FOLDER, Collection } from "../src/helpers/constant";

describe("CollectionBuilder", () => {
    const baseUrl = "https://example.com";
    let graph: Graph;
    let links: Links;
    let collectionBuilder: CollectionBuilder;

    const collections: Collection[] = [
        {
            "@id": "collections/tags",
            src: ["blogs/**/*"],
            groupBy: (mainEntity) => {
                return mainEntity.keywords.map(tag => ({
                    tag: tag
                }));
            },
            sortBy: {
                prop: "position",
                order: "asc"
            }
        }, 
        {
            "@id": "collections/year",
            src: ["blogs/**/*"],
            groupBy: (mainEntity) => {
                return {
                    year: mainEntity.dateCreated.getFullYear()
                }
            },
            sortBy: {
                prop: "dateModified",
                order: "asc"
            }
        }
    ];

    beforeEach(async () => {
        links = new Links();
        collectionBuilder = new CollectionBuilder(collections);
        graph = new Graph(new Media(CACHE_FOLDER, []), links, collectionBuilder);
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

    it('getCollectionByIRI', async () => {
        const collection: any = await collectionBuilder.getCollectionByIRI("collections/year/_part/year=2019");
        expect(collection["@id"]).toBe("/collections/year/_part/year=2019");
        expect(collection.itemListElement[0]["@id"]).toBe("/blogs/blog1");
    });

});