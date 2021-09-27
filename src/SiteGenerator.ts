import path from "path";
import Renderer from "./Renderer";
import prettier from "prettier";
import { writeText, getFileExt, isObjectLiteral } from "./helpers/util";
import { inferUrl } from "./helpers/data";
import { serializeJsonLd } from "./helpers/seo";
import { log } from "./helpers/log";
import { OUTPUT_FOLDER, PAGES_FOLDER } from "./helpers/constant";
import Router from "./Router";
import UriResolver from "./UriResolver";
import { template } from "./ui/template";
import {
    JSONLD_ID,
    JSONLD_TYPE,
    JSONLD_CONTEXT,
    SCHEMA_CONTEXT,
    isJsonLdRef,
    isAbsUri
} from "sambal-jsonld";

type SiteMapItem = {
    loc: string,
    lastmod?: string
}

const JSONLD_FILENAME = "schema.json";

export default class SiteGenerator {
    private siteMap: SiteMapItem[];
    constructor(
        private baseUrl: string,
        private uriResolver: UriResolver,
        private router: Router,
        private renderer: Renderer
    ) {
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
        for (const uri of this.uriResolver.referencedJsonLds) {
            let jsonld = await this.uriResolver.resolveUri(uri);
            if (!isJsonLdRef(jsonld)) {
                jsonld = {
                    [JSONLD_ID]: this.getJsonLdId(uri),
                    [JSONLD_CONTEXT]: {
                        "@vocab": `${SCHEMA_CONTEXT}/`,
                        "@base": this.baseUrl
                    },
                    url: inferUrl(uri),
                    ...jsonld
                };
                this.updateRef(jsonld);
                await writeText(
                    `./${OUTPUT_FOLDER}${jsonld[JSONLD_ID]}`,
                    serializeJsonLd(jsonld, false)
                );
            }
        }
    }

    private getJsonLdId(uri: string) {
        if (isAbsUri(uri)) {
            return uri;
        }
        
        if (uri.startsWith(`/${PAGES_FOLDER}`)) {
            const url = inferUrl(uri);
            return url === "/" ? `/${JSONLD_FILENAME}` : `${url}/${JSONLD_FILENAME}`;
        }
        return `${uri}/${JSONLD_FILENAME}`;
    }

    private updateRef(jsonld: any) {
        if (Array.isArray(jsonld)) {
            return jsonld.map(j => this.updateRef(j));
        }

        if (isJsonLdRef(jsonld)) {
            jsonld[JSONLD_ID] = this.getJsonLdId(jsonld[JSONLD_ID]);
        } else if (isObjectLiteral(jsonld)) {
            for (const fieldName of Object.keys(jsonld)) {
                if (fieldName !== JSONLD_ID && fieldName !== JSONLD_TYPE && fieldName !== JSONLD_CONTEXT) {
                    const fieldValue = jsonld[fieldName];
                    jsonld[fieldName] = this.updateRef(fieldValue);
                }
            }
        }
        return jsonld;
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