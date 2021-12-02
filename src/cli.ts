import program from "commander";
import shelljs from "shelljs";
import {
    OUTPUT_FOLDER,
    SAMBAL_ENTRY_FILE,
    SAMBAL_SITE_FILE,
    CACHE_FOLDER,
    PAGES_FOLDER,
    DEVSERVER_BROWSER
} from "./helpers/constant";
import { getAbsFilePath, writeText, normalizeUri } from "./helpers/util";
import Bundler from "./Bundler";
import Renderer from "./Renderer";
import SiteGenerator from "./SiteGenerator";
import DevServer from "./DevServer";
import Media from "./Media";
import Router from "./Router";
import UriResolver from "./UriResolver";
import {
    initSambalEntry,
    initSambalSite,
    initBlogpost1,
    initBlogpost2,
    initBundle,
    initCss,
    initIndex,
    initPerson
} from "./helpers/init";
import { log } from "./helpers/log";

const siteFile = getAbsFilePath(SAMBAL_SITE_FILE);
let entryFile = getAbsFilePath(SAMBAL_ENTRY_FILE);
let baseUrl: string = "";
let theme = null;

async function initSite(outputFolder: string) {
    if (shelljs.test('-f', siteFile)) {
        log.info("Bundling sambal.site.js...");
        const moduleEntry = await Bundler.bundleSambalFile(siteFile);
        const module = require(moduleEntry);

        if (!module.siteConfig) {
            throw new Error("Required siteConfig object not exported from sambal.site.js");
        }
        if (!module.siteConfig.baseUrl) {
            throw new Error("Required baseUrl not found in siteConfig in sambal.site.js");
        }
        if (!shelljs.test('-f', entryFile)) {
            entryFile = null;  // optional
        }
        baseUrl = module.siteConfig.baseUrl;
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length - 1);
        }
        log.info(`baseUrl: ${baseUrl}`);
        theme = module.siteConfig.theme;
        
        if (!theme && !entryFile) {
            throw new Error("No sambal.entry.js file found and no theme specified");
        }

        const media = new Media(baseUrl, outputFolder);
        const collections = Array.isArray(module.siteConfig.collections) ? module.siteConfig.collections : [];
        collections.forEach(c => {
            c.uri = normalizeUri(c.uri);
        });

        const uriResolver = new UriResolver(collections, media);
        const resolvers = Array.isArray(module.siteConfig.resolvers) ? module.siteConfig.resolvers : [];
        for (const resolver of resolvers) {
            if (resolver.host && resolver.resolveUri) {
                uriResolver.addResolver(
                    {host: resolver.host},
                    {
                        resolveUri: resolver.resolveUri,
                        clearCache: () => {}
                    }
                );
            }
        }
        
        const router = new Router(uriResolver);
        return {
            media,
            router,
            uriResolver
        };
    }
    throw new Error("No sambal.site.js file found");
}

async function serve() {
    log.info("Cleaning cache folder");
    clean(`./${CACHE_FOLDER}`);

    try {
        const init = await initSite(CACHE_FOLDER);

        const renderer = new Renderer(baseUrl, DEVSERVER_BROWSER, entryFile, theme);

        const server = new DevServer(init.uriResolver, init.media, init.router, renderer, 3000);
        await server.start();
    } catch(e) {
        log.error(e);
    }
}

async function build() {
    log.info("Cleaning cache and public folder");
    clean(`./${OUTPUT_FOLDER}`);
    clean(`./${CACHE_FOLDER}`);
    const publicPath = `/js`;
    
    try {
        const init = await initSite(OUTPUT_FOLDER);

        const renderer = new Renderer(baseUrl, publicPath, entryFile, theme);
        await renderer.bundle();

        const builder = new SiteGenerator(baseUrl, init.uriResolver, init.router, renderer);
        await builder.buildPages();

        log.info("Writing schema.org json-lds");
        await builder.buildJsonLds();
        await builder.generateSiteMap();
    } catch(e) {
        log.error(e);
    }
}

async function init() {
    try {
        await writeText(getAbsFilePath(`${PAGES_FOLDER}/index.yml`), initIndex());
        await writeText(getAbsFilePath(`${PAGES_FOLDER}/blogs/blog1.md`), initBlogpost1("/data/author.yml"));
        await writeText(getAbsFilePath(`${PAGES_FOLDER}/blogs/blog2.md`), initBlogpost2());
        await writeText(getAbsFilePath("css/style.css"), initCss());
        await writeText(getAbsFilePath("js/bundle.js"), initBundle("../css/style.css"));
        await writeText(getAbsFilePath("data/author.yml"), initPerson());
        await writeText(getAbsFilePath(SAMBAL_SITE_FILE), initSambalSite());
        await writeText(getAbsFilePath(SAMBAL_ENTRY_FILE), initSambalEntry());
    } catch(e) {
        log.error(e);
    }
}

function clean(folder: string) {
    shelljs.rm("-rf", folder);
}

program
.command(`init`)
.description('Init Sambal project files')
.action(init);

program
.command(`build`)
.description('Generate static website')
.action(build);

program
.command(`serve`)
.description('Start dev server')
.action(serve);

program
.command('*')
.action(function(env){
    log.error('Unrecognized command.  sambal --help for more info');
});

program
.parse(process.argv);

if (!program.args.length) {
    program.help();
}
