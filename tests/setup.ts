import Media from "../src/Media";
import Router from "../src/Router";
import UriResolver from "../src/UriResolver";
import { CACHE_FOLDER, PAGES_FOLDER, DATA_FOLDER, Collection } from "../src/helpers/constant";
import { searchFiles } from "../src/helpers/data";

const imageTransforms = [
    {
        match: "/images/**/*",
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
        match: ["/blogs/**/*"],
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
        match: ["/blogs/**/*"],
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
        match: ["/images/**/*"]
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

const pages = searchFiles(PAGES_FOLDER, "**/*");
const data = searchFiles(DATA_FOLDER, "**/*");

export async function init(extraPages = []) {
    const allPages = [...pages, ...extraPages];
    const media = new Media(pages, data, CACHE_FOLDER, imageTransforms);
    const uriResolver = new UriResolver(allPages, data, media);
    const router = new Router(allPages, data, uriResolver);

    uriResolver.addResolver({host: "custom.com"}, {
        resolveUri: customResolver.resolveUri,
        clearCache: () => {}
    });
    
    await router.collectRoutes(collections);

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
