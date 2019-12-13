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
sambal.indexContent();
// sambal.collectionIds("tags", "javascript").subscribe(d => console.log(d));