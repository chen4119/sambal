import SambalCollection from "../src/SambalCollection";
import {from} from "rxjs";
import {toArray} from "rxjs/operators";
import moment from "moment";

describe("SambalCollection", () => {

    const collections = [{
        name: "groupByKeys",
        groupBy: "keywords",
        sortBy: [{field: "dateCreated", order: "desc"}]
    }, {
        name: "latest",
        sortBy: [{field: "dateCreated", order: "desc"}]
    }, {
        name: "order",
        sortBy: [{field: "order", order: "asc"}]
    }];

    const data = [{
        url: "/one",
        keywords: ["javascript", "rxjs"],
        dateCreated: moment("2012-12-25").toDate(),
        order: 3
    }, {
        url: "/two",
        keywords: ["java"],
        dateCreated: moment("2001-12-25").toDate(),
        order: 1
    }, {
        url: "/three",
        keywords: ["javascript", "c#"],
        order: 2
    }, {
        url: "/four",
        dateCreated: moment("1995-12-25").toDate()
    }];

    let indexer: SambalCollection;
    beforeEach(async () => {
        indexer = new SambalCollection(collections);
        await indexer.indexContent(from(data));
    });

    it('order index sorted asc', async () => {
        const index = await indexer.collection("order").pipe(toArray()).toPromise();
        expect(index).toStrictEqual(["/two", "/three", "/one", "/four"]);
    });

    it('latest index sorted desc', async () => {
        const index = await indexer.collection("latest").pipe(toArray()).toPromise();
        expect(index).toStrictEqual(["/one", "/two", "/four", "/three"]);
    });

    it('javascript partition', async () => {
        const index = await indexer.collection("groupByKeys", {keywords: "javascript"}).pipe(toArray()).toPromise();
        expect(index).toStrictEqual(["/one", "/three"]);
    });

    it('c# partition', async () => {
        const index = await indexer.collection("groupByKeys", {keywords: "c#"}).pipe(toArray()).toPromise();
        expect(index).toStrictEqual(["/three"]);
    });

    it('empty partition', async () => {
        const index = await indexer.collection("groupByKeys", {keywords: ""}).pipe(toArray()).toPromise();
        expect(index).toStrictEqual(["/four"]);
    });

    it('null partition', async () => {
        const index = await indexer.collection("groupByKeys", {keywords: null}).pipe(toArray()).toPromise();
        expect(index).toStrictEqual(["/four"]);
    });

    it('invalid collection', async () => {
        const index = await indexer.collection("abs").pipe(toArray()).toPromise();
        expect(index.length).toBe(0);
    });

    it('latest index stats', async () => {
        const stats = await indexer.stats("latest");
        expect(stats.size).toBe(4);
    });

    it('groupByKeys index stats', async () => {
        const stats = await indexer.stats("groupByKeys");
        expect(stats.partitions.length).toBe(5);
    });
});