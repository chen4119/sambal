import {queryData} from "../Utils";
import {from, of, pipe} from "rxjs";
import {mergeMap, map, groupBy, reduce, toArray} from "rxjs/operators";

export function aggregateBy(field: string) {
    return pipe(
        map((data) => queryData(data, field)),
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