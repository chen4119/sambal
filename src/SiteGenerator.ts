import path from "path";
import Renderer from "./Renderer";
import prettier from "prettier";
import { writeText, getFileExt } from "./helpers/util";
import { log } from "./helpers/log";
import { OUTPUT_FOLDER } from "./helpers/constant";
import Router from "./Router";
import { JSONLD_ID } from "sambal-jsonld";
import { template } from "./ui/template";

type SiteMapItem = {
    loc: string,
    lastmod?: string
}

export default class SiteGenerator {
    private siteMap: SiteMapItem[];
    constructor(private baseUrl: string, private router: Router, private renderer: Renderer) {
        this.siteMap = [];
    }

    async buildPages(publicPath: string) {
        const iterator = this.router.getPageIterator();
        for await (const page of iterator) {
            log.info(`Rendering ${page.url}`);
            this.siteMap.push({
                loc: `${this.baseUrl}${page.url}`
            });
            let html = await this.renderer.renderPage(page, publicPath);
            try {
                html =  prettier.format(html, {parser: "html"});
            } catch (e) {
                log.error("Unable to prettify html.  Check if you have unescaped <> characters", e);
            }
            await this.serializeHtml(`./${OUTPUT_FOLDER}${page.url}`, html);
        }
    }

    async buildJsonLds() {
        const iterator = this.router.getJsonLdIterator(this.baseUrl);
        for await (const jsonld of iterator) {
            log.info(`Writing ${jsonld[JSONLD_ID]}`);
            await writeText(`./${OUTPUT_FOLDER}${jsonld[JSONLD_ID]}/schema.json`, JSON.stringify(jsonld, null, 4));
        }
    }

    async generateSiteMap() {
        const output = `./${OUTPUT_FOLDER}/sitemap.xml`;
        log.info(`Writing ${output}`);
        const siteMapXml = prettier.format(await this.siteMapEntryList(this.siteMap), {parser: "html"});
        await writeText(output, siteMapXml);
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

    private siteMapEntry(item: SiteMapItem) {
        return template`
            <url>
                <loc>${item.loc}</loc>
                ${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : null}
            </url>
        `;
    };
    
    private siteMapEntryList(siteMapItems: SiteMapItem[]) {
        return template`
            <?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                ${siteMapItems.map(item => this.siteMapEntry(item))}
            </urlset> 
        `;
    }
    
    /*
    private siteMapIndex({baseUrl, sitemaps}) {
        return template`
            <?xml version="1.0" encoding="UTF-8"?>
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            ${sitemaps.map(fileName => {
                return template`
                    <sitemap>
                        <loc>${baseUrl}/${fileName}</loc>
                        <lastmod>${new Date().toISOString()}</lastmod>
                    </sitemap>
                `;
            })}
            </sitemapindex>
        `;
    }*/
}