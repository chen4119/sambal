import Media from "../src/Media";
import Router from "../src/Router";
import UriResolver from "../src/UriResolver";
import { CACHE_FOLDER, Collection } from "../src/helpers/constant";

const imageTransforms = [
    {
        include: "data/images/**/*",
        width: 500,
        encodingFormat: "image/webp",
        thumbnails: [
            {
                suffix: "50",
                height: 50
            }
        ]
    }
];

const collections: Collection[] = [
    {
        uri: "/collections/tags",
        include: ["pages/blogs/**/*"],
        groupBy: (mainEntity) => {
            return mainEntity.keywords.map(tag => ({
                tag: tag
            }));
        },
        sort: (a, b) => {
            return a.position - b.position;
        }
    },
    {
        uri: "/collections/year",
        include: ["pages/blogs/**/*"],
        groupBy: (mainEntity) => {
            return {
                year: mainEntity.dateCreated.getFullYear()
            }
        },
        sort: (a, b) => {
            return a.dateModified.getTime() - b.dateModified.getTime();
        }
    },
    {
        uri: "/collections/images",
        include: ["data/images/**/*"]
    }
];

const customResolver = {
    resolveUri: async (uri) => {
        return [
            {
                "@type": "Organization",
                identifier: "org-a",
                name: "org a",
                telephone: "123-435-2334",
                address: {
                    "@type": "PostalAddress",
                    streetAddress: "1 main st",
                    postalCode: 12345
                }
            },
            {
                "@type": "Organization",
                identifier: "org-b",
                name: "org b",
                telephone: "123-435-1564"
            }        
        ];
    }
}

export async function init() {
    const baseUrl = "https://example.com";
    const media = new Media(baseUrl, CACHE_FOLDER, imageTransforms);
    const uriResolver = new UriResolver(collections, media);
    const router = new Router(uriResolver);

    uriResolver.addResolver({host: "custom.com"}, {
        resolveUri: customResolver.resolveUri,
        clearCache: () => {}
    });
    
    await router.collectRoutes();

    return {
        uriResolver,
        media,
        router
    };
}

export async function wait() {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, 1000);
    });
}
