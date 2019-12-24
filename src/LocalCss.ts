import jss, {SheetsRegistry} from "jss";
import preset from "jss-preset-default";

jss.setup(preset());

class LocalCss {
    private registry: SheetsRegistry = new SheetsRegistry();
    private numSheets: number = 0;
    constructor() {
        
    }

    style(styleObj: object) {
        const sheet = jss.createStyleSheet(styleObj);
        this.registry.add(sheet);
        this.numSheets ++;
        return sheet.classes;
    }

    getCss(): string {
        return this.registry.toString();
    }

    hasSheets(): boolean {
        return this.numSheets > 0;
    }
}

export default LocalCss;