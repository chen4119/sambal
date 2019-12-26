import LinkedDataStore, {CollectionDef} from "./LinkedDataStore";
import {from, Subject, Observable} from "rxjs";
import {map, mergeAll, tap, multicast} from "rxjs/operators";
import {template} from "./template";
import {render} from "./operators/render";
import {toHtml} from "./operators/toHtml";
import Packager from "./Packager";
import LocalCss from "./LocalCss";

const collections: CollectionDef[] = [
    {
        name: "tags",
        groupBy: ["keywords"],
        sortBy: {field: "dateCreated", order: "desc"}
    }
];

function renderPage({css}) {
    const classes = css.style({
        main: {
            width: '100%'
        }
    });
    return template`
        <html>
            <head>
                <script src="js/index.js"></script>
            </head>
            <body>
                <div class="${classes.main}">
                    <h1>dih</h1>
                </div>
            </body>
        </html>
    `;
}


/*
from([{
    path: "foisf.md",
    data: {headline:'test'}
}])
.pipe(render(renderPage, {type: "BlogPosting"}))
.pipe(toHtml())
.subscribe(d => console.log(d));
*/

// const packager = new Packager(obs, null);
// packager.deliver();

const store = new LinkedDataStore({contentPath: ["content"], collections: collections});
store.content().subscribe(d => console.log(d));
// store.indexContent();
// store.collectionPartitions("tags").subscribe(d => console.log(d));
// store.collection("tags", "javascript").subscribe(d => console.log(d));
store.start();
