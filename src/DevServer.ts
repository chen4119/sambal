import express from "express";
import Renderer from "./Renderer";
import { DEVSERVER_BROWSER } from "./helpers/constant";
import { log } from "./helpers/log";
import Router from "./Router";
import Media from "./Media";
import { Server, OPEN } from "ws";
import { FSWatcher } from "chokidar";
import { getAbsFilePath, getFileExt, getMimeType, readFileAsBuffer } from "./helpers/util";

const WEBSOCKET_ADDR = "ws://localhost:3001/";
const CMD_REFRESH = "refresh";

export default class DevServer {
    private expressApp;
    private server;
    private webSocketServer: Server;
    private watcher: FSWatcher;
    
    constructor(
        private media: Media,
        private router: Router,
        private renderer: Renderer,
        private port: Number) {
    }
    
    async start() {
        this.watcher = await this.router.watchForFileChange((type, path) => {
            this.refreshBrowser();
        });

        await this.renderer.devInit((urls) => {
            this.refreshBrowser(urls);
        });

        this.startWebSocket();
        this.startDevServer();
    }

    async stop() {
        await this.watcher.close();
        await this.renderer.stop();
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
        this.expressApp.get(`/${DEVSERVER_BROWSER}/*`, this.getLocalFile.bind(this));
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

    private refreshBrowser(urls?: string[]) {
        if (this.webSocketServer) {
            this.webSocketServer.clients.forEach(client => {
                if (client.readyState === OPEN) {
                    client.send(CMD_REFRESH);
                }
            });
        }
    }
    
    private async getLocalFile(req, res) {
        try {
            const file = await readFileAsBuffer(getAbsFilePath(req.path));
            res.set("Content-Type", getMimeType(getFileExt(req.path)));
            res.send(file);
        } catch (e) {
            log.error(e);
            res.status(404).end();
        }
    }

    private async route(req, res) {
        log.debug(`Get path uri: ${req.path}`);
        try {
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
            
            await this.getLocalFile(req, res);
        } catch(e) {
            const html = await this.renderer.renderErrorPage(e);
            res.send(this.addBrowserSyncScript(html));
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