
export function initSambalEntry(): string {
    return`
export function renderPage({ page, options }) {

}

export const defaultOptions = {
    testing: true
}
`.trim();
}

export function initSambalSite(): string {
    return`
export function siteMap(router) {
    
}

export const siteConfig = {
    baseUrl: "https://example.com",
    collections: [
        // see doc
    ],
    imageTransforms: [
        // see doc
    ],
    // theme: "sambal-ui-material"
};
`.trim();
}

export function initPerson(): string {
    return`
"@type": Person
name: Blue Devil
email: blue@devil.com
familyName: Devil
givenName: Blue
`.trim();
}

export function initBlogpost(authorIRI: string): string {
    return`
---
"@type": BlogPosting
headline: My first blog
author:
    "@id": ${authorIRI}
dateCreated: 2002-05-01
keywords: ["tag1", "tag2"]
---

Go Duke!
`.trim();
}