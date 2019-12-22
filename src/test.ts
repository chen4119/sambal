import LinkedDataStore, {CollectionDef} from "./LinkedDataStore";
import {importCssModule} from "./cssModule";
import {from} from "rxjs";
import {template} from "./template";
import {render} from "./operators/render";
import Packager from "./Packager";

const collections: CollectionDef[] = [
    {
        name: "tags",
        groupBy: ["keywords"],
        sortBy: {field: "dateCreated", order: "desc"}
    }
];

function renderPage({classes}) {
    return template`
        <div class="${classes.article}">
            <h1>dih</h1>
        </div>
    `;
}

/*
const obs = from([{
    path: "foisf.md",
    data: {headline:'test'}
}])
.pipe(render(renderPage, "content/test.css"));

const packager = new Packager(obs, null);
packager.deliver();*/

// .subscribe(d => console.log(d.html.html()));

const store = new LinkedDataStore({contentPath: ["content"], collections: collections});
// importCssModule("./content/test.css");
store.indexContent();
// store.collectionPartitions("tags").subscribe(d => console.log(d));
// store.collection("tags", "javascript").subscribe(d => console.log(d));
