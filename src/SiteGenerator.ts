import path from "path";
import Renderer from "./Renderer";
import prettier from "prettier";
import { writeText, getFileExt } from "./helpers/util";
import { log } from "./helpers/log";
import { OUTPUT_FOLDER } from "./helpers/constant";
import Router from "./Router";
import { JSONLD_ID } from "sambal-jsonld";

export default class SiteGenerator {
    constructor(private router: Router, private renderer: Renderer) {

    }

    async buildPages(publicPath: string) {
        const iterator = this.router.getPageIterator();
        for await (const page of iterator) {
            log.info(`Rendering ${page.url}`);
            let html = await this.renderer.renderPage(page, publicPath);
            html =  prettier.format(html, {parser: "html"});
            await this.serializeHtml(`./${OUTPUT_FOLDER}${page.url}`, html);
        }
    }

    async buildJsonLds(baseUrl: string) {
        const iterator = this.router.getJsonLdIterator(baseUrl);
        for await (const jsonld of iterator) {
            log.info(`Writing ${jsonld[JSONLD_ID]}`);
            await writeText(`./${OUTPUT_FOLDER}${jsonld[JSONLD_ID]}/schema.json`, JSON.stringify(jsonld, null, 4));
        }
    }

    private async serializeHtml(dest: string, content: string) {
        const ext = getFileExt(dest);
        let output = dest;
        if (ext !== 'html' && ext !== 'htm' && ext !== 'json') {
            output = `${dest}/index.html`;
        }
        output = path.normalize(output);
        return await writeText(output, content);
    }
}