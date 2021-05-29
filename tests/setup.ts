import CollectionBuilder from "../src/CollectionBuilder";
import Graph from "../src/Graph";
import Media from "../src/Media";
import Router from "../src/Router";
import UriResolver from "../src/UriResolver";
import FileSystemResolver from "../src/resolvers/FileSystemResolver";
import HttpResolver from "../src/resolvers/HttpResolver";
import { CACHE_FOLDER, PAGES_FOLDER, DATA_FOLDER } from "../src/helpers/constant";
import { searchFiles } from "../src/helpers/data";


const pages = searchFiles(PAGES_FOLDER, "**/*", true);
const data = searchFiles(DATA_FOLDER, "**/*", true);

export function init(collections, imageTransforms) {
    const media = new Media(CACHE_FOLDER, imageTransforms);
    const uriResolver = new UriResolver(pages, data, media);
    const router = new Router(pages, data, collections, uriResolver);
    
    return {
        uriResolver,
        media,
        router
    };
}

/*
export function getPages() {
    return pages;
}

export function getData() {
    return data;
}*/