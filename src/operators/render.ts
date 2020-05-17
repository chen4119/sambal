import {pipe, Observable} from "rxjs";
import {mergeMap} from "rxjs/operators";
import LocalCss from "../LocalCss";
import {SambalData, SAMBAL_INTERNAL} from "../constants";

export function render(renderer: (props: any) => Promise<string>) {
    return pipe<Observable<any>, Observable<SambalData>>(
        mergeMap(async (data: any) => {
            const css = new LocalCss();

            if (!data[SAMBAL_INTERNAL]) {
                data[SAMBAL_INTERNAL] = {};
            }
            data[SAMBAL_INTERNAL].css = css;
            data[SAMBAL_INTERNAL].html = await renderer({...data, css: css});
            return data;
        })
    );
}
