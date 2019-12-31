import LinkedDataStore from "./LinkedDataStore";
import {CollectionDef} from "./constants";
import {from, Subject, Observable} from "rxjs";
import {map, mergeAll, tap, multicast} from "rxjs/operators";
import {template} from "./template";
import {render} from "./operators/render";
import {toHtml} from "./operators/toHtml";
import {toSchemaOrgJsonLd} from "./index";
import {pushSchemaOrgJsonLd} from "./operators/pushSchemaOrgJsonLd";
import Packager from "./Packager";
import LocalCss from "./LocalCss";
import {getUriPath} from "./utils";
import path from "path";

const collections: CollectionDef[] = [
    {
        name: "tags",
        groupBy: ["keywords"],
        sortBy: {field: "dateCreated", order: "desc"}
    }
];

function renderPage(props) {
    const classes = props.css.style({
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
const obs = from([{
    headline:'test',
    url: 'https://chen4119.me/post2'
}])
.pipe(pushSchemaOrgJsonLd(d => toSchemaOrgJsonLd(d, "BlogPosting")))
.pipe(render(renderPage));
// .pipe(toHtml())
// .subscribe(d => console.log(d));

const packager = new Packager(obs);
packager.deliver();*/

const store = new LinkedDataStore("https://chen4119.me", {contentPath: ["content"], collections: collections});
// store.content().subscribe(d => console.log(d));

/*
(async () => {
    const sizes = await store.stats("tags");
    console.log(sizes.partitions);
})();*/
// store.indexContent();
store.collection("tags", {keywords: "javascript"}).subscribe(d => console.log(d));
store.start();

// console.log(getUriPath(null, "https://chen4119.me/post1", {}));

