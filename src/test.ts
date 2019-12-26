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

const subject = new Subject<any>();

const obs1 = subject.pipe(map(d => ({...d, test: "hello"})));
const obs2 = subject.pipe(map(d => ({...d, test: "hello2"})));


from([obs1, obs2])
.pipe(mergeAll())
.subscribe(d => console.log(d));

const obs = new Observable((subscriber => {
    console.log("subscribing");
    subscriber.next({
        path: "foisf.md",
        data: {headline:'test'}
    });
    subscriber.complete();
}))
.pipe(tap(d => console.log("TAPPED!")))
.subscribe(subject);
// .pipe(multicast(() => new Subject<any>()));




// .pipe(render(renderPage, {type: "BlogPosting"}));
// .pipe(toHtml())
// .subscribe(d => console.log(d));

// const packager = new Packager(obs, null);
// packager.deliver();

// .subscribe(d => console.log(d.html.html()));

// const store = new LinkedDataStore({contentPath: ["content"], collections: collections});
// store.indexContent();
// store.collectionPartitions("tags").subscribe(d => console.log(d));
// store.collection("tags", "javascript").subscribe(d => console.log(d));
