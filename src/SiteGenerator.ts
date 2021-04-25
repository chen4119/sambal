import path from "path";
import { WebPage } from "./helpers/constant";
import Renderer from "./Renderer";
import prettier from "prettier";
import { writeText } from "./helpers/util";
import { log } from "./helpers/log";
import { OUTPUT_FOLDER } from "./helpers/constant";

export default class SiteGenerator {
    constructor(private publicPath: string, private renderer: Renderer) {

    }

    async start(pages: WebPage[]) {
        for (const page of pages) {
            log.info(`Rendering ${page.url}`);
            let html = await this.renderer.renderPage(page, this.publicPath);
            html =  prettier.format(html, {parser: "html"});
            await this.write(`./${OUTPUT_FOLDER}${page.url}`, html);
        }
    }

    private async write(dest: string, content: string) {
        const ext = path.extname(dest).toLowerCase();
        let output = dest;
        if (ext !== '.html' && ext !== '.htm' && ext !== '.json') {
            output = `${dest}/index.html`;
        }
        output = path.normalize(output);
        return await writeText(output, content);
    }
}