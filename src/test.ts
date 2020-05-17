import SambalCollection from "./SambalCollection";
import {CollectionDef} from "./constants";
import {from, Subject, Observable} from "rxjs";
import {map, mergeAll, tap, multicast} from "rxjs/operators";
import {template} from "./template";
import {render} from "./operators/render";
import {toHtml} from "./operators/toHtml";
import {loadContent} from "./utils";
import {toSchemaOrgJsonLd, loadJsonLd, pushJsonLd} from "./index";
import LocalCss from "./LocalCss";
import {prettify} from "./html";
import Logger from "./Logger";

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
from([{
    headline:'test',
    url: 'https://chen4119.me/post2'
}])
.pipe(pushJsonLd(d => toSchemaOrgJsonLd(d, "BlogPosting")))
.pipe(render(renderPage))
.pipe(toHtml({
    editAttribs: (name, attribs) => {
        if (name === 'script') {
            return {
                src: "sfoijwef"
            };
        }
        return attribs;
    }
}))
.subscribe(d => console.log(d));
*/


from(['./content/post2.md'])
.pipe(loadJsonLd())
.pipe(render(({text}) => {
    return template`
        <!doctype html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
                <meta http-equiv="X-UA-Compatible" content="ie=edge">
                <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
                <meta http-equiv="Pragma" content="no-cache">
                <meta http-equiv="Expires" content="0">
                <base href="/">
                
                <script src="./js/index.js"></script>
            </head>
            <body>
                ${template`
                    <main>
                        ${text}
                    </main>
                    <a>hellowe</a>
                `}
                <br>
                <br>
            </body>
        </html>
    `;
}))
.pipe(toHtml({
    editAttribs: (name, attribs) => {
        if (name === 'script') {
            return {
                src: 'sdf'
            };
        }
        return attribs;
    }
}))
.subscribe(d => console.log(d));


/*
from(['https://www.imdb.com/title/tt1843866'])
.pipe(loadJsonLd())
.pipe(map(data => data[0]))
.pipe(pushJsonLd(d => toSchemaOrgJsonLd(d, "Movie")))
.pipe(render(({css, name, actor}) => {
    const classes = css.style({
        actor: {
            "font-style": "italic"
        }
    });

    return template`
        <html>
            <body>
                <h1>Movie name: ${name}</h1>
                ${actor.map(a => (template`
                    <span class="${classes.actor}">${a.name}</span>
                `))}
            </body>
        </html>
    `;
}))
.pipe(toHtml({
    editAttribs: (name, attribs) => attribs
}))
.subscribe(d => console.log(d));
*/

/*
const collections: CollectionDef[] = [
    {
        name: "tags",
        groupBy: ["keywords"],
        sortBy: {field: "dateCreated", order: "desc"}
    }
];

const content$ = from([
    {url: '/post1', keywords: ['javascript', 'php'], dateCreated: new Date()},
    {url: '/post2', keywords: ['javascript', 'golang'], dateCreated: new Date()},
    {url: '/post3'},
    {keywords: ['javascript', 'php']}
]);
const store = new SambalCollection(collections);
// store.indexContent(content$);
// store.collection("tags", {keywords: "javascript"}).subscribe(d => console.log(d));


(async () => {
    const sizes = await store.stats("tags");
    console.log(sizes.partitions);
})();
*/

/*
(async () => {
    const nodes = [{
        name: 'script',
        body: JSON.stringify({headline: 'hasoidf', description: 'som desciof'}),
        attributes: {
            type: "application/ld+json"
        }
    }];
    const result = await prettify(`
        <!doctype html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="description" content="Free Web tutorials">
                <meta name="keywords" content="HTML, CSS, JavaScript">
                <meta name="author" content="John Doe">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <script src="dfsoi"></script>
            </head>
            <body>
                <h1>Hello wordl</h1>
                <h1>Hello wordl</h1>
                <br>
            </body>
        </html>
    `, nodes);
    console.log(result);
})();
*/
