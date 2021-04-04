import { parseBundleFilename } from "./helpers/bundler";
import { OnBundleChanged } from "./helpers/constant";

class WebpackListenerPlugin {
    constructor(private onChange: OnBundleChanged) {
        
    }

    apply(compiler) {
        compiler.hooks.done.tap("WebpackListenerPlugin", stats => {
            const info = stats.toJson();
            this.onChange(false, parseBundleFilename(info));
        });
    }
}

export default WebpackListenerPlugin;