import Sambal from "./Sambal";

const collections = [
    {
        name: "tags",
        groupBy: ["keywords"],
        sortBy: {field: "dateCreated", order: "desc"},
        pageSize: 100
    }
]
const sambal = new Sambal("content", {collections: collections});
// sambal.indexContent();
// sambal.collectionPartitions("tags").subscribe(d => console.log(d));
sambal.collection("tags", "javascript").subscribe(d => console.log(d));
