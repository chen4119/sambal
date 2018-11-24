import {collect} from "./collector";

collect([{
    name: 'blogs',
    glob: "data/**/*.md",
    sortBy: [{field: "year", order: "desc"}],
    partitionBy: ["author"]
}], 'test');
