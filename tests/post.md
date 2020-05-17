---
headline: Second post
breadcrumb: guide
description: Some description
keywords: ["javascript", "rxjs"]
dateCreated: 2019-03-04
id: second
---


This is my very first post1

```ShellSession
$ npm install --save-dev sambal-cli
```

Sambal has [webpack](https://webpack.org), [webpack](https://webpack.org), [webpack](https://webpack.org) to do with something else

```js
import {pipe, from, of} from "rxjs";
import {mergeMap, map, groupBy, reduce, toArray} from "rxjs/operators";

function aggregateBy(field) {
    return pipe(
        map((data) => data[field]),
        mergeMap(fieldValue => Array.isArray(fieldValue) ? from(fieldValue) : of(fieldValue)),
        groupBy(v => v),
        mergeMap(group$ =>
            group$.pipe(reduce((acc, cur) => {
                acc.count++;
                return acc;
            }, {key: group$.key, count: 0}))    
        ),
        toArray()
    );
}
```