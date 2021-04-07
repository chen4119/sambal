
export function siteMap(router) {
    
}

export const siteConfig = {
    baseUrl: "https://example.com",
    collections: [
        {
            "@id": "by tags",
            // "@type": "BreadcrumbList",
            src: ["blogs/**/*"],
            groupBy: (mainEntity) => {
                return mainEntity.keywords.map(tag => ({
                    tag: tag
                }));
            },
            sortBy: {
                prop: "position",
                order: "asc"
            }
        }
    ],
    imageTransforms: [
        {
            src: "media/*.png",
            encodingFormat: "image/webp",
            width: 500,
            thumbnails: [
                {
                    name: "cat-30",
                    width: 30
                }
            ]
        }
    ],
    theme: {
        name: "sambal-ui-material",
        options: {
            hello: true
        }
    }
};
