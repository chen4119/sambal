import SambalCollection from "./SambalCollection";
import {CollectionDef} from "./constants";
import {from, Subject, Observable} from "rxjs";
import {map, mergeAll, tap, multicast} from "rxjs/operators";
import {template} from "./template";
import {render} from "./operators/render";
import {toHtml} from "./operators/toHtml";
import {dom} from "./operators/dom";
import {loadContent} from "./utils";
import {toSchemaOrgJsonLd, loadJsonLd, pushSchemaOrgJsonLd} from "./index";
import LocalCss from "./LocalCss";

import path from "path";
import Logger from "./Logger";

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
.pipe(render(renderPage))
.pipe(dom(($) => {
    const scriptSelector = 'script[src]';
    $(scriptSelector).each(function() {
        //TODO: Normalize jsFile
        const jsFile = $(this).attr("src");
        $(this).attr("src", '1234');
        // const isModule = $(this).attr("type") === "module";
    });
}))
.pipe(toHtml())
.subscribe(d => console.log(d));*/

from(['content/post1.md'])
.pipe(loadJsonLd({
    fetcher: (async url => {
        return await loadContent(url);
    })
}))
.subscribe(d => console.log(d));

/*
const content$ = from([
    {url: '/post1', keywords: ['javascript', 'php'], dateCreated: new Date()},
    {url: '/post2', keywords: ['javascript', 'golang'], dateCreated: new Date()},
    {url: '/post3'},
    {keywords: ['javascript', 'php']}
]);
const store = new SambalCollection(content$, collections);
store.indexContent();*/
// store.collection("tags", {keywords: "javascript"}).subscribe(d => console.log(d));

/*
(async () => {
    const sizes = await store.stats("tags");
    console.log(sizes.partitions);
})();
store.start();*/


