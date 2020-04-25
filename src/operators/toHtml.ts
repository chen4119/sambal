import {pipe} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {SAMBAL_INTERNAL} from "../constants";
import {HtmlAttributes, editHtml} from "../html";
import Logger from "../Logger";

type EditAttributesFn = (name: string, attribs: HtmlAttributes) => HtmlAttributes;

const log: Logger = new Logger({name: "toHtml"});
export function toHtml(editOptions?: {editAttribs: EditAttributesFn}) {
    return pipe(
        mergeMap(async d => {
            if (d[SAMBAL_INTERNAL] && d[SAMBAL_INTERNAL].html) {
                if (editOptions) {
                    return await editHtml(d[SAMBAL_INTERNAL].html, editOptions.editAttribs);
                }
                return d[SAMBAL_INTERNAL].html;
            }
            log.warn("No html rendered.  Need to call render first");
            return "";
        })
    );
}