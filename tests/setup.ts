import Media from "../src/Media";
import Router from "../src/Router";
import UriResolver from "../src/UriResolver";
import { CACHE_FOLDER, PAGES_FOLDER, DATA_FOLDER, Collection } from "../src/helpers/constant";
import { searchFiles } from "../src/helpers/data";

const imageTransforms = [
    {
        src: "images/image2.jpg",
        width: 500,
        encodingFormat: "image/webp",
        thumbnails: [
            {
                name: "image2-50",
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
    }
];

const pages = searchFiles(PAGES_FOLDER, "**/*", true);
const data = searchFiles(DATA_FOLDER, "**/*", true);

export function init() {
    const media = new Media(CACHE_FOLDER, imageTransforms);
    const uriResolver = new UriResolver(pages, data, media);
    const router = new Router(pages, data, collections, uriResolver);
    
    return {
        uriResolver,
        media,
        router
    };
}
