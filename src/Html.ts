import { parseDocument } from "htmlparser2";
import { DataNode, Document, Element, isText, Node, Text } from "domhandler";
import render from "dom-serializer";
import {
    appendChild,
    getAttributeValue,
    getElementsByTagName,
    prependChild,
    replaceElement,
    textContent
} from "domutils";
import { WebPage } from "./helpers/constant";
import { isSchemaType, SCHEMA_CONTEXT, JSONLD_TYPE } from "sambal-jsonld";

const JSON_LD_TYPE = "application/ld+json";

type HtmlMeta = {
    canonicalUrl: string,
    title: string,
    description: string
    // image: string
};

export default class Html {
    
    private dom: Document;
    // map script src to element
    private jsScriptMap: Map<string, Element>;
    private cssLinkMap: Map<string, Element>;
    private styleTags: Element[];
    private jsonldElement: Element;
    private headElement: Element;


    constructor(html: string) {
        this.dom = parseDocument(html);
        this.jsScriptMap = new Map<string, Element>();
        this.cssLinkMap = new Map<string, Element>();
        const headNode = getElementsByTagName("head", this.dom);
        if (headNode.length === 0) {
            this.headElement = new Element("head", {});
            prependChild(this.dom as Element, this.headElement);
        } else {
            this.headElement = headNode[0];
        }

        this.styleTags = getElementsByTagName("style", this.dom, true);
        const linkNodes = getElementsByTagName("link", this.dom, true);
        for (const node of linkNodes) {
            const src = getAttributeValue(node, "href");
            const type = getAttributeValue(node, "rel");
            if (type && type.toLowerCase() === "stylesheet") {
                this.cssLinkMap.set(src, node);
            }
        }

        const scriptNodes = getElementsByTagName("script", this.dom, true);
        for (const node of scriptNodes) {
            const src = getAttributeValue(node, "src");
            const type = getAttributeValue(node, "type");
            if (type && type.toLowerCase() === JSON_LD_TYPE) {
                this.jsonldElement = node;
            } else if (src) {
                this.jsScriptMap.set(src, node);
            }
        }
    }

    addSchemaJsonLd(mainEntity: any) {
        this.upsertElementToHead(
            this.jsonldElement,
            "script",
            {type: JSON_LD_TYPE},
            Html.serializeJsonLd(mainEntity)
        );
    }

    static serializeJsonLd(mainEntity: any) {
        const mainEntityWithContext = {
            "@context": SCHEMA_CONTEXT,
            ...mainEntity
        };
        return JSON.stringify(
            // isMinimize ? this.minimizeEntity(mainEntityWithContext) : mainEntityWithContext,
            mainEntityWithContext, 
            null, 4)
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    /*
    private minimizeEntity(mainEntity) {
        if (isSchemaType(mainEntity, "Article")) {
            const minEntity = {...mainEntity};
            delete minEntity.text;
            delete minEntity.encodingFormat;
            return minEntity;
        }
        return mainEntity;
    }*/

    get hasJsonLd(): boolean {
        return Boolean(this.jsonldElement);
    }

    get jsSources(): string[] {
        return [...this.jsScriptMap.keys()];
    }

    get styleSheets(): string[] {
        return [...this.cssLinkMap.keys()];
    }

    async bundleStyles(handler:(css: string) => Promise<string>) {
        for (const styleElement of this.styleTags) {
            const resultCss = await handler(textContent(styleElement));
            const newElement = new Element(
                "style",
                {},
                [new Text(resultCss)]
            );
            replaceElement(styleElement, newElement);
        }
    }

    serialize() {
        return render(this.dom);
    }
    
    replaceJsScriptSrc(oldSrc: string, newSrc: string) {
        if (this.jsScriptMap.has(oldSrc)) {
            this.jsScriptMap.get(oldSrc).attribs.src = newSrc;
        }
    }

    replaceStyleSheetSrc(oldSrc: string, newSrc: string) {
        if (this.cssLinkMap.has(oldSrc)) {
            this.cssLinkMap.get(oldSrc).attribs.href = newSrc;
        }
    }

    addMetaTags(baseUrl: string, page: WebPage) {
        if (page.mainEntity[JSONLD_TYPE]) {
            const meta = this.mainEntityToMeta(baseUrl, page);
            const metaElements = getElementsByTagName("meta", this.headElement, false);
            const linkElements = getElementsByTagName("link", this.headElement, false);
            this.addCanonicalUrl(metaElements, linkElements, meta.canonicalUrl);
            if (meta.title) {
                this.addTitleMetas(metaElements, meta.title);
            }
            if (meta.description) {
                this.addDescriptionMetas(metaElements, meta.description);
            }
        }
    }

    private addDescriptionMetas(metaElements: Element[], description: string) {

        this.upsertElementToHead(
            metaElements.find(elem => elem.attribs.name === "description"),
            "meta",
            {name: "description", content: description},
            null
        );

        this.upsertElementToHead(
            metaElements.find(elem => elem.attribs.name === "twitter:description"),
            "meta",
            {name: "twitter:description", content: description},
            null
        );

        this.upsertElementToHead(
            metaElements.find(elem => elem.attribs.name === "og:description"),
            "meta",
            {name: "og:description", content: description},
            null
        );
    }

    private addTitleMetas(metaElements: Element[], title: string) {
        const titleElements = getElementsByTagName("title", this.headElement, false);
        this.upsertElementToHead(
            titleElements.length > 0 ? titleElements[0] : null,
            "title",
            null,
            title
        );

        this.upsertElementToHead(
            metaElements.find(elem => elem.attribs.name === "twitter:title"),
            "meta",
            {name: "twitter:title", content: title},
            null
        );

        this.upsertElementToHead(
            metaElements.find(elem => elem.attribs.name === "og:title"),
            "meta",
            {name: "og:title", content: title},
            null
        );

    }

    private addCanonicalUrl(metaElements: Element[], linkElements: Element[], canonicalUrl: string) {
        this.upsertElementToHead(
            linkElements.find(elem => elem.attribs.rel === "canonical"),
            "link",
            {rel: "canonical", href: canonicalUrl},
            null
        );

        this.upsertElementToHead(
            metaElements.find(elem => elem.attribs.name === "og:url"),
            "meta",
            {name: "og:url", content: canonicalUrl},
            null
        );

    }

    private upsertElementToHead(
        oldElement: Element,
        tagName: string,
        attributes: any,
        textContent:string,
        prepend: boolean = false) {
        const newElement = new Element(
            tagName,
            attributes
        );
        if (textContent) {
            appendChild(newElement, new Text(textContent))
        }
        if (oldElement) {
            replaceElement(oldElement, newElement);
        } else {
            prepend ? 
                prependChild(this.headElement, newElement) :
                appendChild(this.headElement, newElement);
        }
    }

    private mainEntityToMeta(baseUrl: string, page: any): HtmlMeta {
        const { mainEntity, url } = page;
        /*
        let imageUrls;
        if (mainEntity.image) {
            imageUrls = Array.isArray(mainEntity.image) ?
            mainEntity.image.map(im => this.getImageUrl(baseUrl, im)) :
            this.getImageUrl(baseUrl, mainEntity.image);
        }*/
        return {
            canonicalUrl: this.toAbsUrl(baseUrl, url),
            title: mainEntity.headline ? mainEntity.headline : mainEntity.name,
            description: mainEntity.description
        };
    }

    // TODO: imageObj can be a string of urls
    private getImageUrl(baseUrl: string, imageObj: any) {
        // contentUrl will always be relative url
        // TODO: use path.join
        return `${baseUrl}${imageObj.contentUrl}`;
    }
    
    private toAbsUrl(baseUrl: string, path: string) {
        return `${baseUrl}${path}`;
    }
}