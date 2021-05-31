import express from "express";
// import { Watching } from "webpack";
import webpackDevMiddleware from "webpack-dev-middleware";
import Renderer from "./Renderer";
import { WebPage, THEME_PUBLIC_PATH, DEV_PUBLIC_PATH } from "./helpers/constant";
import { log } from "./helpers/log";
import Router from "./Router";

export default class DevServer {
    private expressApp;
    private server;
    // private watchEntryFile: Watching;
    
    constructor(private router: Router, private renderer: Renderer, private port: Number) {
        
    }
    
    start() {
        this.renderer.watchForEntryChange((isError) => {
            log.info("sambal.entry.js compiled");
            if (!isError && !this.expressApp) {
                this.startDevServer();
            }
        });
    }

    stop() {
        this.server.close();
    }
    
    private startDevServer() {
        this.expressApp = express();
        this.addBrowserBundleMiddleware();
        this.expressApp.get(`${THEME_PUBLIC_PATH}/*`, this.getThemeFile.bind(this));
        this.expressApp.get("*", this.route.bind(this));
        this.server = this.expressApp.listen(this.port, () => {
            log.info(`Dev server started on port ${this.port}`);
        });
    }

    private addBrowserBundleMiddleware() {
        const compiler = this.renderer.watchForBrowserBundleChange(this.onBrowserBundleChanged.bind(this));
        if (compiler) {
            const middleware = webpackDevMiddleware(
                compiler, {
                    publicPath: DEV_PUBLIC_PATH
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
        log.debug(`Get path uri: ${req.path}`);
        const page = await this.router.getPage(req.path);
        if (page) {
            let html = await this.renderer.renderPage(page);
            res.send(html);
        } else {
            res.status(404).end();
        }
    }
}