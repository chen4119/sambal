import { template } from "../ui/template";
import { isSchemaType, JSONLD_TYPE } from "sambal-jsonld";
import { WebPage } from "./constant";

export function serializeJsonLd(mainEntity: any) {
    removeUnnecessaryFields(mainEntity);
    return JSON.stringify(mainEntity, null, 4)
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function removeUnnecessaryFields(mainEntity) {
    if (isSchemaType(mainEntity, "Article")) {
        delete mainEntity.text;
        delete mainEntity.encodingFormat;
    }
}

export async function renderSocialMediaMetaTags(baseUrl: string, page: WebPage) {
    if (page.mainEntity[JSONLD_TYPE]) {
        const meta = mainEntityToMeta(baseUrl, page);
        return template`
            ${HtmlTags(meta)}
            ${TwitterTags(meta)}
            ${FbTags(meta)}
        `;
    }
    return "";
}

function mainEntityToMeta(baseUrl: string, page: any) {
    const { mainEntity, url } = page;
    let imageUrls;
    if (mainEntity.image) {
        imageUrls = Array.isArray(mainEntity.image) ?
        mainEntity.image.map(im => getImageUrl(baseUrl, im)) :
        getImageUrl(baseUrl, mainEntity.image);
    }
    return {
        url: toAbsUrl(baseUrl, url),
        title: mainEntity.headline ? mainEntity.headline : mainEntity.name,
        description: mainEntity.description,
        image: imageUrls
    };
}

function getImageUrl(baseUrl: string, imageObj: any) {
    return `${baseUrl}${imageObj.contentUrl}`;
}

function toAbsUrl(baseUrl: string, path: string) {
    return `${baseUrl}${path}`;
}

const HtmlTags = ({ url, title }) => {
    return template`
        <link rel="canonical" href="${url}" />
        ${title ? `<title>${title}</title>` : null}
    `;
}

const FbTags = ({ url, title, description, image }) => {
    return template`
        <meta name="og:url" content="${url}" />
        ${title ? `<meta name="og:title" content="${title}" />` : null}
        ${description ? `<meta name="og:description" content="${description}" />` : null}
    `;
}

const TwitterTags = ({ title, description, image }) => {
    return template`
        <meta name="twitter:card" content="summary" />
        ${title ? `<meta name="twitter:title" content="${title}" />` : null}
        ${description ? `<meta name="twitter:description" content="${description}" />` : null}
    `;
}


