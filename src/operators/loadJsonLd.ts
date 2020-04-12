import {Observable, pipe} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {loadContent} from "../utils";
import {hydrateJsonLd} from "sambal-jsonld";

export function loadJsonLd(hydrateOptions?: {
    fetcher?: (url: string) => Promise<any>,
    context?: any
}) {
    return pipe<Observable<string>, Observable<any>>(
        mergeMap(async src => {
            const content = await loadContent(src);
            if (hydrateOptions) {
                return await hydrateJsonLd(content, hydrateOptions.fetcher, hydrateOptions.context);
            }
            return content;
        })
    );
}