import program from "commander";
import shelljs from "shelljs";
import {
    OUTPUT_FOLDER,
    SAMBAL_ENTRY_FILE,
    SAMBAL_SITE_FILE,
    CACHE_FOLDER
} from "./helpers/constant";
import { getAbsFilePath } from "./helpers/util";
import { bundleSambalFile, bundleBrowserPackage } from "./helpers/bundler";
import Renderer from "./Renderer";
import SiteGenerator from "./SiteGenerator";
import DevServer from "./DevServer";
import CollectionBuilder from "./CollectionBuilder";
import Graph from "./Graph";
import Media from "./Media";
import Router from "./Router";
import Links from "./Links";
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
import { log } from "./helpers/log";

const siteFile = getAbsFilePath(SAMBAL_SITE_FILE);
let entryFile = getAbsFilePath(SAMBAL_ENTRY_FILE);
let siteGraph: Graph;
let baseUrl: string = "";
let theme = null;

async function initSite() {
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
        if (!module.siteMap) {
            throw new Error("Required siteMap function not exported from sambal.site.js");
        }
        if (!shelljs.test('-f', entryFile)) {
            entryFile = null;  // optional
        }
        baseUrl = module.siteConfig.baseUrl;
        log.info(`baseUrl: ${baseUrl}`);
        theme = module.siteConfig.theme;
        
        if (!theme && !entryFile) {
            throw new Error("No sambal.entry.js file found and no theme specified");
        }

        const imageTransforms = module.siteConfig.imageTransforms ? module.siteConfig.imageTransforms : [];
        const media = new Media(imageTransforms);
        const collections = module.siteConfig.collections ? module.siteConfig.collections : [];
        const collectionBuilder = new CollectionBuilder(collections);
        const links = new Links();

        siteGraph = new Graph(baseUrl, media, links, collectionBuilder);

        const router = new Router(siteGraph, collectionBuilder);
        module.siteMap(router.instance);
        log.info("Getting all routes...");
        return await router.getRoutes();
    } else {
        throw new Error("No sambal.site.js file found");
    }

    return [];
}

async function serve() {
    log.info("Cleaning cache folder");
    clean(`./${CACHE_FOLDER}`);
    const publicPath = "/_sambal";

    try {
        const pages = await initSite();

        const renderer = new Renderer(entryFile, theme, publicPath, siteGraph);
        await renderer.initTheme();

        const server = new DevServer(publicPath, renderer, 3000);
        server.start(pages);
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
        const pages = await initSite();

        const renderer = new Renderer(entryFile, theme, publicPath, siteGraph);
        await renderer.init();

        const builder = new SiteGenerator(baseUrl, renderer);
        await builder.start(pages);

        log.info("Writing schema.org json-lds");
        await siteGraph.serialize();
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
                browserBundleEntry[fieldName] = `client/${browserBundleEntry[fieldName]}`;
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

function clean(folder: string) {
    shelljs.rm("-rf", folder);
}

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
    // log.error('Unrecognized command.  sambal --help for more info');
});

program
.parse(process.argv);

if (!program.args.length) {
    program.help();
}
