
export function initSambalEntry(): string {
    return`
import React from "react";

const Head = () => (
    <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
        <meta httpEquiv="X-UA-Compatible" content="ie=edge"/>
    </head>
);

export function renderPage({ page, options }) {
    const { mainEntity } = page;
    return (
        <html>
            <Head/>
            <body>
                <h1>{mainEntity.headline}</h1>
                <p>By {mainEntity.author.name}</p>
                <p>Google Analytics Id {options.googleAnalyticsId}</p>
            </body>
        </html>
    );
}

export const defaultOptions = {
    googleAnalyticsId: "UA-123"
}
`.trim();
}

export function initSambalSite(): string {
    return`
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

First post on Sambal!
`.trim();
}