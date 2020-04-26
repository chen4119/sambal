
# [Sambal](https://sambal.dev)

## Intro

Build fast and SEO friendly website with [RxJs](https://rxjs-dev.firebaseapp.com/).  Run inside a nodejs web server or CLI script.  No new template syntax to learn, just pure Javascript template literal.  Support schema.org vocabularies and json-ld (json linked data) format.

## Installation

```sh
npm install --save-dev sambal
```

Or use with [Sambal CLI](https://github.com/chen4119/sambal-cli) for integrated dev server, javascript bundling, and static site generation

## Example

```js
const {template, render, pushSchemaOrgJsonLd, toSchemaOrgJsonLd, loadJsonLd, toHtml} = require("sambal");
const {from} = require("rxjs");
const {map} = require("rxjs/operators");

from(['https://www.imdb.com/title/tt1843866'])
.pipe(loadJsonLd())                                                                    // load json-ld from url or local drive.  Supports html, json, md, or yml
.pipe(map(data => data[0]))
.pipe(pushSchemaOrgJsonLd(d => toSchemaOrgJsonLd(d, "Movie")))                         // Add schema.org json-ld metadata to your HTML doc
.pipe(render(({css, name, actor}) => {
    const classes = css.style({                                                        // jss instance injected into render function
        actor: {
            "font-style": "italic"
        }
    });
                                                                                       // render HTML using javascript template literal
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
.pipe(toHtml())
.subscribe(d => console.log(d));
```