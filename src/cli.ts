import program from "commander";
import shelljs from "shelljs";
import {
    OUTPUT_FOLDER,
    SAMBAL_ENTRY_FILE,
    SAMBAL_SITE_FILE,
    CACHE_FOLDER,
    PAGES_FOLDER
} from "./helpers/constant";
import { getAbsFilePath, writeText, normalizeUri } from "./helpers/util";
import { bundleSambalFile, bundleBrowserPackage } from "./helpers/bundler";
import Renderer from "./Renderer";
import SiteGenerator from "./SiteGenerator";
import DevServer from "./DevServer";
import Media from "./Media";
import Router from "./Router";
import UriResolver from "./UriResolver";
import {
    makeVariableStatement,
    makeStringLiteral,
    makeCallExpression,
    makeEqualsBinaryExpression,
    makePropertyAccess,
    makeIdentifier,
    makeObjectLiteral,
    makePropertyAssignment,
    objectToObjectLiteral,
    makeExpressionStatement,
    writeJavascript
} from "./helpers/ast";
import {
    initSambalEntry,
    initSambalSite,
    initBlogpost,
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
        await bundleSambalFile(siteFile, getAbsFilePath(`${CACHE_FOLDER}/output`));
        const module = require(getAbsFilePath(`${CACHE_FOLDER}/output/${SAMBAL_SITE_FILE}`));

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

        const imageTransforms = Array.isArray(module.siteConfig.imageTransforms) ? module.siteConfig.imageTransforms : [];
        const media = new Media(outputFolder, imageTransforms);
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
        await router.collectRoutes();
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

        const renderer = new Renderer(baseUrl, entryFile, theme);
        await renderer.initTheme();

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

        const renderer = new Renderer(baseUrl, entryFile, theme);
        await renderer.build(publicPath);

        const builder = new SiteGenerator(baseUrl, init.uriResolver, init.router, renderer);
        await builder.buildPages(publicPath);

        log.info("Writing schema.org json-lds");
        await builder.buildJsonLds();
        await builder.generateSiteMap();
    } catch(e) {
        log.error(e);
    }
}

async function publishTheme() {
    log.info("Cleaning cache and dist folder");
    clean(`./${CACHE_FOLDER}`);
    clean("./dist");

    if (!entryFile) {
        log.info("Exiting. No sambal.entry.js file found");
        return;
    }

    try {
        log.info("Bundling sambal.entry.js...");
        await bundleSambalFile(entryFile, getAbsFilePath("dist/server"), false);
        const module = require(getAbsFilePath(`dist/server/${SAMBAL_ENTRY_FILE}`));
        let browserBundleEntry = {};
        if (module.browserBundle) {
            log.info("Bundling browser bundle...");
            browserBundleEntry = await bundleBrowserPackage(
                module.browserBundle,
                getAbsFilePath("dist/client")
            );
            for (const fieldName of Object.keys(browserBundleEntry)) {
                browserBundleEntry[fieldName] = browserBundleEntry[fieldName];
            }
        }
        const statements = [];
        statements.push(
            makeVariableStatement(
                undefined,
                "entry",
                makeCallExpression("require", [makeStringLiteral("./server/sambal.entry")])
            )
        );
        const leftExpr = makePropertyAccess(makeIdentifier("module"), "exports");
        const rightExpr = makeObjectLiteral([
            makePropertyAssignment("entry", makeIdentifier("entry")),
            makePropertyAssignment("browserBundle", objectToObjectLiteral(browserBundleEntry))
        ]);
        statements.push(
            makeExpressionStatement(makeEqualsBinaryExpression(leftExpr, rightExpr))
        );
        writeJavascript(statements, "dist/index.js");
    } catch(e) {
        log.error(e);
    }
}

async function init() {
    try {
        await writeText(getAbsFilePath(`${PAGES_FOLDER}/index.md`), initBlogpost("/data/author.yml"));
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
.command(`theme`)
.description('Publish theme')
.action(publishTheme);

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
