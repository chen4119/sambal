import React from "react";
import ReactDOMServer from "react-dom/server";
import {
    IHtmlSerializer
} from "../helpers/constant";

export default class ReactSerializer implements IHtmlSerializer {

    constructor() {
        
    }

    toHtml(renderResult: unknown) {
        return ReactDOMServer.renderToString(
            <>
                {renderResult}
            </>
        );
    }
}