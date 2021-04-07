import express from "express";
// import { Watching } from "webpack";
import webpackDevMiddleware from "webpack-dev-middleware";
import Renderer from "./Renderer";
import { WebPage } from "./helpers/constant";
import { log } from "./helpers/log";

export default class DevServer {
    private expressApp;
    // private watchEntryFile: Watching;
    private routeMap: Map<string, WebPage> = new Map<string, WebPage>();
    constructor(private publicPath: string, private renderer: Renderer, private port: Number) {

    }
    
    start(pages: WebPage[]) {
        this.renderer.watchForEntryChange((isError) => {
            log.info("sambal.entry.js compiled");
            if (!isError && !this.expressApp) {
                this.startDevServer(pages);
            }
        });
    }

    private startDevServer(pages: WebPage[]) {
        this.expressApp = express();
        this.addBrowserBundleMiddleware();
        for (const page of pages) {
            this.routeMap.set(page.url, page);
            this.expressApp.get(page.url, this.route.bind(this));
        }
        this.expressApp.listen(this.port, () => {
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