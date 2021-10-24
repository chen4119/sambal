
export function initSambalEntry(): string {
    return`
import React from "react";
import { isSchemaType } from "sambal";

export function renderPage({ page, options }) {
    return (
        <html>
            <Head/>
            <body>
                {isSchemaType(page.mainEntity, "article") ?
                    <BlogPost 
                        mainEntity={page.mainEntity}
                    /> :
                    <Landing 
                        mainEntity={page.mainEntity}
                        options={options}
                    />}
            </body>
        </html>
    );
}

const Head = () => (
    <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
        <meta httpEquiv="X-UA-Compatible" content="ie=edge"/>
        <script src="myBundle"></script>
    </head>
);

const BlogPost = ({ mainEntity }) => {
    return (
        <div>
            <h1>{mainEntity.headline}</h1>
            <b>Auther: {mainEntity.author.name}</b>
            <br/>
            <b>Tags: {mainEntity.keywords.join(", ")}</b>
            <p>{mainEntity.text}</p>
            {mainEntity.image &&
                <img src={mainEntity.image.contentUrl}/>}
            {mainEntity.image && mainEntity.image.thumbnail &&
                <img src={mainEntity.image.thumbnail[0].contentUrl}/>}
        </div>
    );
};

const LinkList = ({ list }) => (
    <ul>
        {list.map(item => (
                <li key={item.url}>
                    <a href={item.url}>{item.headline}</a>
                </li>
        ))}
    </ul>
);

const Landing = ({ mainEntity, options }) => {
    return (
        <div>
            <h1>{mainEntity.headline}</h1>
            <p>{mainEntity.description}</p>
            <b>My blogposts</b>
            <LinkList 
                list={mainEntity.allPosts.itemListElement}
            />
            <b>Blogposts tagged with "webdev"</b>
            <LinkList 
                list={mainEntity.postsByTag.itemListElement}
            />
            <b>Default options:</b>
            <p>Google Analytics Id {options.googleAnalyticsId}</p>
        </div>
    );
};

// User defined options
export const defaultOptions = {
    googleAnalyticsId: "UA-123"
};

export const browserBundle = {
    entry: {
        myBundle: "./js/bundle.js"
    }
};
`.trim();
}

export function initSambalSite(): string {
    return`
export const siteConfig = {
    baseUrl: "https://example.com",
    collections: [
        {
            // collection of blogs sorted by date created
            uri: "/blogs/latest",
            include: ["pages/blogs/**/*"],
            sort: (a, b) => {
                return b.dateCreated.getTime() - a.dateCreated.getTime();
            }
        },
        {
            // collection of blogs group by tag
            uri: "/blogs/tag",
            include: ["pages/blogs/**/*"],
            groupBy: (mainEntity) => {
                return mainEntity.keywords.map(tag => ({
                    tag: tag
                }));
            }
        }
    ],
    imageTransforms: [
        {
            include: ["https://picsum.photos/200/300.jpg"],
            // convert image to webp
            encodingFormat: "image/webp",
            // generate thumbnail with width=50px
            thumbnails: [
                {
                    suffix: "50",
                    width: 50
                }
            ]
        }
    ],
    resolvers: [
        {
            // resovle any url from https://dummydomain.com
            host: "dummydomain.com",
            resolveUri: async (uri) => {
                return {
                    "@type": "Person",
                    name: "Remote Person",
                };
            }
        }
    ],
    // theme: "sambal-ui-material"
};
`.trim();
}

export function initCss(): string {
    return`
h1 {
    color: blue
}
`.trim();
}

export function initBundle(cssPath: string): string {
    return`
import "${cssPath}";
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

export function initBlogpost1(authorIRI: string): string {
    return`
---
"@type": BlogPosting
headline: My first blog
description: First blog generated by Sambal
author:
    "@id": ${authorIRI}
image:
    "@id": https://picsum.photos/200/300.jpg
dateCreated: 2002-07-01
keywords: ["semantic", "json-ld"]
---

I am already SEO! Right click on this webpage, go to "View page source" and see that Facebook, Twitter, and application/ld+json meta tags are auto populated
`.trim();
}

export function initBlogpost2(): string {
    return`
---
"@type": BlogPosting
headline: My second blog
description: Second blog generated by Sambal
author:
    "@id": https://dummydomain.com/person/1
dateCreated: 2002-05-01
keywords: ["webdev", "semantic"]
---

I am already SEO! Right click on this webpage, go to "View page source" and see that Facebook, Twitter, and application/ld+json meta tags are auto populated
`.trim();
}

export function initIndex(): string {
    return`
headline: Welcome to Sambal!
description: Generate website directly from schema.org json-ld data.  Plain old json works too if you prefer.  /pages/index.yml is just json data!
allPosts:
    "@id": /blogs/latest
postsByTag:
    "@id": /blogs/tag?tag=webdev    
`.trim();
}