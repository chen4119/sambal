import {of, from} from "rxjs";
import {loadJsonLd} from "../../src/operators/loadJsonLd";
import {listJsonLd} from "../../src/operators/listJsonLd";
import {pushJsonLd} from "../../src/operators/pushJsonLd";
import {toSchemaOrgJsonLd} from "sambal-jsonld";

describe('listJsonLd', () => {

    it('add schema.org to head', async () => {
        const result = await from(['tests/post.md'])
        .pipe(loadJsonLd())
        .pipe(pushJsonLd(d => toSchemaOrgJsonLd(d, "BlogPosting")))
        .pipe(listJsonLd())
        .toPromise();
        expect(result).toMatchSnapshot();
    });


})