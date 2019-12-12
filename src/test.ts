import Sambal from "./Sambal";

const collections = [
    {
        name: "tags",
        groupBy: ["keywords"],
        sortBy: ["dateCreated"],
        pageSize: 100
    }
]
const sambal = new Sambal("content", {collections: collections});
sambal.collection("tags", "javascript").subscribe(d => console.log(d));