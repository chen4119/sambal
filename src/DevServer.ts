import express from "express";
// import { Watching } from "webpack";
import webpackDevMiddleware from "webpack-dev-middleware";
import Renderer from "./Renderer";
import { WebPage, THEME_PUBLIC_PATH } from "./helpers/constant";
import { log } from "./helpers/log";

export default class DevServer {
    private expressApp;
    private server;
    // private watchEntryFile: Watching;
    private routeMap: Map<string, WebPage>;
    
    constructor(private publicPath: string, private renderer: Renderer, private port: Number) {
        this.routeMap = new Map<string, WebPage>();
    }
    
    start(pages: WebPage[]) {
        this.renderer.watchForEntryChange((isError) => {
            log.info("sambal.entry.js compiled");
            if (!isError && !this.expressApp) {
                this.startDevServer(pages);
            }
        });
    }

    stop() {
        this.server.close();
    }
    
    private startDevServer(pages: WebPage[]) {
        this.expressApp = express();
        this.addBrowserBundleMiddleware();
        this.expressApp.get(`${THEME_PUBLIC_PATH}/*`, this.getThemeFile.bind(this));
        for (const page of pages) {
            this.routeMap.set(page.url, page);
            this.expressApp.get(page.url, this.route.bind(this));
        }
        this.server = this.expressApp.listen(this.port, () => {
            log.info(`Dev server started on port ${this.port}`);
        });
    }

    private addBrowserBundleMiddleware() {
        const compiler = this.renderer.watchForBrowserBundleChange(this.onBrowserBundleChanged.bind(this));
        if (compiler) {
            const middleware = webpackDevMiddleware(
                compiler, {
                    publicPath: this.publicPath
                });
            this.expressApp.use(middleware);
        }
    }

    private onBrowserBundleChanged(isError, entry) {
        log.info("Browser bundle compiled");
    }

    private async getThemeFile(req, res) {
        try {
            const file = await this.renderer.getThemeFile(req.path.substring(THEME_PUBLIC_PATH.length));
            res.set("Content-Type", file.mime);
            res.send(file.data);
        } catch (e) {
            log.error(e);
            res.status(404).end();
        }
    }

    private async route(req, res) {
        const route = this.routeMap.get(req.path);
        if (route) {
            let html = await this.renderer.renderPage(route);
            res.send(html);
        } else {
            res.status(404).end();
        }
    }
}