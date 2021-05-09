import shelljs from "shelljs";
import Graph from "../src/Graph";
import Media from "../src/Media";
import Links from "../src/Links";
import CollectionBuilder from "../src/CollectionBuilder";
import { OUTPUT_FOLDER } from "../src/helpers/constant";
import { getAbsFilePath } from "../src/helpers/util";

describe("Graph", () => {
    const baseUrl = "https://example.com";
    let graph: Graph;
    let links: Links;
    let collectionBuilder: CollectionBuilder;


    beforeEach(async () => {
        links = new Links();
        collectionBuilder = new CollectionBuilder([]);
        graph = new Graph(new Media(OUTPUT_FOLDER, []), links, collectionBuilder);
    });

    afterEach(async () => {
        shelljs.rm("-rf", OUTPUT_FOLDER);
    });

    it('serialize', async () => {
        await graph.load("blogs/blog1");
        await graph.serialize(baseUrl);
        expect(shelljs.test('-f', getAbsFilePath(`${OUTPUT_FOLDER}/content/blogs/blog1.json`))).toBeTruthy();
        expect(shelljs.test('-f', getAbsFilePath(`${OUTPUT_FOLDER}/content/johnsmith.json`))).toBeTruthy();
    });

    


});