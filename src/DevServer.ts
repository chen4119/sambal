import express from "express";
// import { Watching } from "webpack";
import webpackDevMiddleware from "webpack-dev-middleware";
import Renderer from "./Renderer";
import { THEME_PUBLIC_PATH, DEV_PUBLIC_PATH } from "./helpers/constant";
import { log } from "./helpers/log";
import Router from "./Router";
import UriResolver from "./UriResolver";
import Media from "./Media";
import { Server, OPEN } from "ws";
import { FSWatcher } from "chokidar";

const WEBSOCKET_ADDR = "ws://localhost:3001/";
const CMD_REFRESH = "refresh";

export default class DevServer {
    private expressApp;
    private server;
    private webSocketServer: Server;
    private watcher: FSWatcher;
    // private watchEntryFile: Watching;
    
    constructor(
        private uriResolver: UriResolver,
        private media: Media,
        private router: Router,
        private renderer: Renderer,
        private port: Number) {
    }
    
    async start() {
        this.watcher = await this.router.watchForFileChange((type, path) => {
            this.refreshBrowser();
        });

        this.renderer.watchForEntryChange((isError) => {
            log.info("sambal.entry.js compiled");
            if (!isError && !this.expressApp) {
                this.startWebSocket();
                this.startDevServer();
            } else {
                this.refreshBrowser();
            }
        });
    }

    async stop() {
        await this.watcher.close();
        return new Promise<void>((resolve, reject) => {
            let numClosed = 2;
            this.server.close(() => {
                numClosed--;
                if (numClosed === 0) {
                    resolve();
                }
            });
            this.webSocketServer.close(() => {
                numClosed--;
                if (numClosed === 0) {
                    resolve();
                }
            });
        });
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

    private startWebSocket() {
        this.webSocketServer = new Server({
            port: 3001
        });
    }

    private refreshBrowser() {
        if (this.webSocketServer) {
            this.webSocketServer.clients.forEach(client => {
                if (client.readyState === OPEN) {
                    client.send(CMD_REFRESH);
                }
            });
        }
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
        this.refreshBrowser();
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
            const html = await this.renderer.renderPage(page);
            res.send(this.addBrowserSyncScript(html));
            return;
        }

        const image = await this.media.loadImage(req.path);
        if (image) {
            res.send(image);
            return;
        }
        
        try {
            res.send(await this.uriResolver.resolveUri(req.path));
        } catch (e) {
            res.status(404).end();
        }
    }

    private addBrowserSyncScript(html: string) {
        const browserSync = `
        <script>
            function openSocket() {
                const sambalws = new WebSocket("${WEBSOCKET_ADDR}");
                sambalws.onopen = function() {
                    console.log('Sambal dev server connected');
                };
                
                sambalws.onmessage = function(e) {
                    if (e.data === "${CMD_REFRESH}") {
                        console.log('Reloading...');
                        window.location.reload();
                    }
                }
    
                sambalws.onclose = function(e) {
                    console.log("Sambal dev server disconnected");
                    setTimeout(() => {
                        openSocket();
                    }, 2000);
                };
            }
            openSocket();
        </script>`;

        const index = html.indexOf("</body>");
        return html.substring(0, index) + browserSync + html.substring(index);
    }
}