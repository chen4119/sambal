import webpack, { Configuration } from "webpack";
import path from "path";
import nodeExternals from "webpack-node-externals";
import {
    CACHE_FOLDER,
    OnBundleChanged
} from "./constant";
import { log } from "./log";

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
                        plugins: ["@babel/plugin-transform-runtime"]
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
            {
                // Apply rule for fonts files
                test: /\.(svg|woff|woff2|ttf|otf|eot)$/,
                type: "asset/inline"
            },
        ]
    }
};

export async function bundleSambalFile(entry: string, outputPath: string, isExcludeNode: boolean = true) {
    return new Promise<void>((resolve, reject) => {
        const config: Configuration = {
            ...webpackConfig,
            ...isExcludeNode ? nodeJsConfig : { externalsPresets: { node: true } },
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
            parseStats(err, stats, () => {
                if (!err) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    });
}

export function watchSambalFile(entry: string, onChange: OnBundleChanged) {
    const config: Configuration = {
        ...webpackConfig,
        ...nodeJsConfig,
        entry: entry,
        mode: "development",
        devtool: "eval-source-map",
        output: {
            ...outputConfig,
            filename: "[name].[contenthash].js",
            path: path.resolve(process.cwd(), `./${CACHE_FOLDER}/watch`)
        }
    };
    const compiler = webpack(config);

    return compiler.watch({
        aggregateTimeout: 300,
        poll: 1000
    }, (err, stats) => {
        parseStats(err, stats, onChange);
    });
}

export async function bundleBrowserPackage(bundleConfig: any, outputPath: string) {
    return new Promise<object>((resolve, reject) => {
        const config: Configuration = {
            ...webpackConfig,
            entry: bundleConfig.entry,
            mode: "production",
            output: {
                ...outputConfig,
                filename: "[name].[contenthash].js",
                path: outputPath
            }
        };
        const compiler = webpack(config);
        compiler.run((err, stats) => {
            parseStats(err, stats, (isError, entry) => {
                if (!err) {
                    resolve(entry);
                } else {
                    reject(err);
                }
            });
        });
    });
}

export function getDevServerBrowserCompiler(bundleConfig: any, listener) {
    const config: Configuration = {
        ...webpackConfig,
        entry: bundleConfig.entry,
        mode: "development",
        devtool: "eval-source-map",
        output: {
            ...outputConfig,
            filename: "[name].[contenthash].js"
        },
        plugins: [listener]
    };
    return webpack(config);
}

export function parseBundleFilename(stats) {
    const entries: any = {};
    for (const key of Object.keys(stats.entrypoints)) {
        const mainAsset = stats.entrypoints[key].assets[0];
        entries[key] = mainAsset.name;
    }
    return entries;
}

function parseStats(err, stats, onChange: OnBundleChanged) {
    const info = stats.toJson();
    const entry = parseBundleFilename(info);
    if (err) {
        log.error(err.stack || err.message);
        onChange(true, entry);
        return;
    }
    if (stats.hasErrors()) {
        // log.error(info.errors);
        for (const err of info.errors) {
            log.error(err.message);
        }
        onChange(true, entry);
        return;
    }
    if (stats.hasWarnings()) {
        // console.warn("%O", ...info.warnings);
        for (const warning of info.warnings) {
            log.warn(warning.message);
        }
    }
    onChange(false, entry);
}