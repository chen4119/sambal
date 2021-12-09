import webpack, { Configuration, Watching } from "webpack";
import postcss, { ProcessOptions } from "postcss";
import chokidar, { FSWatcher } from "chokidar";
import { postcssPlugin } from "./helpers/postcss";
import atImport from "postcss-import";
import cssnano from "cssnano";
import path from "path";
import { readFileSync } from "fs";
import nodeExternals from "webpack-node-externals";
import {
    OUTPUT_SAMBAL,
    DEVSERVER_SAMBAL
} from "./helpers/constant";
import { log } from "./helpers/log";
import { getAbsFilePath, writeText, hashContent } from "./helpers/util";

const outputConfig = {
    library: {
        type: "umd"
    },
    globalObject: 'this'
};

const nodeJsConfig = {
    externalsPresets: { node: true },
    externals: [nodeExternals()]
};

const webpackConfig = {
    resolve: {
        extensions: [".js", ".jsx"]
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env", "@babel/preset-react"],
                        // need this for async/await
                        plugins: ["@babel/plugin-transform-runtime"]
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
                type: 'asset',
            },
            {
                // Apply rule for fonts files
                test: /\.(woff|woff2|ttf|otf|eot)$/,
                type: "asset"
            },
        ]
    }
};

type Watcher = {
    chokidarWatch?: FSWatcher,
    webpackWatch?: Watching,
    entry: string
}

type OnAssetChangedHandler = (uri: string, entry: string) => void;

export default class Bundler {
    private browserBundleMap: Map<string, Watcher>;
    constructor(private onChangedHandler?: OnAssetChangedHandler) {
        this.browserBundleMap = new Map<string, Watcher>();
    }

    static async bundleSambalFile(entry: string) {
        const outputPath = getAbsFilePath(OUTPUT_SAMBAL);
        return new Promise<string>((resolve, reject) => {
            const config: Configuration = {
                ...webpackConfig,
                ...nodeJsConfig,
                entry: entry,
                mode: "production",
                output: {
                    ...outputConfig,
                    filename: path.basename(entry),
                    path: outputPath
                }
            };
            const compiler = webpack(config);
            compiler.run((err, stats) => {
                const result = Bundler.parseStats(err, stats);
                if (result.error) {
                    reject(result.error);
                } else {
                    resolve(path.join(outputPath, result.entry.main));
                }
            });
        });
    }

    static async bundleBrowserPackage(filePath: string, outputPath: string) {
        return new Promise<string>((resolve, reject) => {
            const config: Configuration = {
                ...webpackConfig,
                entry: filePath,
                mode: "production",
                output: {
                    ...outputConfig,
                    filename: "[name].[contenthash].js",
                    // Hardcoded output public path
                    path: path.resolve(process.cwd(), outputPath)
                }
            };
            const compiler = webpack(config);
            compiler.run((err, stats) => {
                const result = Bundler.parseStats(err, stats);
                if (result.error) {
                    reject(result.error);
                } else {
                    resolve(path.join(outputPath, result.entry.main));
                }
            });
        });
    }

    static async bundleStyle(assetMap: Map<string, string>, style: string, outputPath: string) {
        const options: ProcessOptions = {
            from: "./index.css", // dummy file for path resolution only
            to: outputPath
        };
        
        const result = await Bundler.bundleCss(assetMap, style, options);
        return result.css;
    }

    static async bundleCssFile(assetMap: Map<string, string>, filePath: string, outputPath: string) {
        const result = await Bundler.bundleCssFileHelper(assetMap, filePath, outputPath);
        return result.entry;
    }

    async watchCssFile(assetMap: Map<string, string>, filePath: string, outputPath: string) {
        if (this.browserBundleMap.has(filePath)) {
            return this.browserBundleMap.get(filePath).entry;
        }
        const result = await Bundler.bundleCssFileHelper(assetMap, filePath, outputPath);
        const dependencies = result.result.messages
            .filter(d => d.type === "dependency")
            .map(d => d.file);
        const watcher = chokidar.watch([getAbsFilePath(filePath), ...dependencies]);
        watcher.on("ready", () => {
            watcher.on("change", async () => {
                const result = await Bundler.bundleCssFileHelper(assetMap, filePath, outputPath);
                const entry = path.join(outputPath, result.entry);
                this.browserBundleMap.get(filePath).entry = entry;
                this.broadcastAssetChangedEvent(filePath, entry);
            });
        });
        const entry = path.join(outputPath, result.entry);
        this.browserBundleMap.set(filePath, {
            chokidarWatch: watcher,
            entry
        });
        
        return entry;
    }

    private static async bundleCssFileHelper(assetMap: Map<string, string>, filePath: string, outputPath: string) {
        const options: ProcessOptions = {
            from: filePath,
            to: outputPath
        };
        
        const originalCss = readFileSync(getAbsFilePath(filePath), "utf-8");
        const result = await Bundler.bundleCss(assetMap, originalCss, options);

        const hash = hashContent(result.css);
        const destFilename = `${path.basename(filePath, path.extname(filePath))}.${hash}${path.extname(filePath)}`;
        const entry = path.join(outputPath, path.dirname(filePath), destFilename);
        await writeText(getAbsFilePath(entry), result.css);
        return {
            result,
            entry
        };
    }

    private static async bundleCss(assetMap: Map<string, string>, originalCss: string, options: ProcessOptions) {
        const result = await postcss([
            atImport(),
            postcssPlugin(assetMap),
            // cssnano({preset: 'default'}) as AcceptedPlugin
        ]).process(originalCss, options);
        return result;
    }

    stop() {
        for (const bundle of this.browserBundleMap.values()) {
            if (bundle.webpackWatch) {
                bundle.webpackWatch.close(() => {});
            }
            if (bundle.chokidarWatch) {
                bundle.chokidarWatch.close();
            }
        }
    }

    async watchSambalFile(filePath: string) {
        const outputPath = getAbsFilePath(DEVSERVER_SAMBAL);
        const config: Configuration = {
            ...webpackConfig,
            ...nodeJsConfig,
            entry: filePath,
            mode: "development",
            devtool: "eval-source-map",
            output: {
                ...outputConfig,
                filename: "[name].[contenthash].js",
                path: outputPath
            }
        };
        return this.webpackWatch(filePath, config, outputPath);
    }

    async watchBrowserBundle(filePath: string, outputPath: string) {
        const config: Configuration = {
            ...webpackConfig,
            entry: filePath,
            mode: "development",
            devtool: "eval-source-map",
            output: {
                ...outputConfig,
                filename: "[name].[contenthash].js",
                path: path.resolve(process.cwd(), outputPath)
            }
        };
        return this.webpackWatch(filePath, config, outputPath);
    }

    private async webpackWatch(filePath: string, webpackConfig: Configuration, outputPath: string) {
        return new Promise<string>((resolve, reject) => {
            if (this.browserBundleMap.has(filePath)) {
                resolve(this.browserBundleMap.get(filePath).entry);
            } else {
                const compiler = webpack(webpackConfig);
                let isPromiseResolved = false;
                const watching: Watching = compiler.watch({
                    aggregateTimeout: 300,
                    poll: 1000
                }, (err, stats) => {
                    const result = Bundler.parseStats(err, stats);
                    const entry = path.join(outputPath, result.entry.main);
                    // const entry = `${outputPath}/${result.entry.main}`;
                    if (!isPromiseResolved) {
                        isPromiseResolved = true;
                        if (result.error) {
                            reject(result.error);
                        } else {
                            this.browserBundleMap.set(filePath, {
                                webpackWatch: watching,
                                entry
                            });
                            resolve(entry);
                        }
                    } else {
                        this.broadcastAssetChangedEvent(filePath, entry);
                    }
                });
            }
        });
    }

    private broadcastAssetChangedEvent(uri: string, entry: string) {
        if (this.browserBundleMap.has(uri)) {
            this.browserBundleMap.get(uri).entry = entry;
        }
        if (this.onChangedHandler) {
            this.onChangedHandler(uri, entry);
        }
    }

    private static parseBundleFilename(stats) {
        const entries: any = {};
        for (const key of Object.keys(stats.entrypoints)) {
            const mainAsset = stats.entrypoints[key].assets[0];
            entries[key] = mainAsset.name;
        }
        return entries;
    }

    private static parseStats(err, stats): {error: any, entry: any} {
        const info = stats.toJson();
        const entry = Bundler.parseBundleFilename(info);
        let error;
        if (err) {
            // log.error(err.stack || err.message);
            error = err;
        }
        if (stats.hasErrors()) {
            /*
            for (const err of info.errors) {
                log.error(err.message);
            }*/
            error = info.errors;
        }
        if (stats.hasWarnings()) {
            // console.warn("%O", ...info.warnings);
            for (const warning of info.warnings) {
                log.warn(warning.message);
            }
        }
        return {
            error,
            entry
        };
    }
}