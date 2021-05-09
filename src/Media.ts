import path from "path";
import sharp, { OutputInfo, Sharp } from "sharp";
import { JSONLD_ID, JSONLD_TYPE } from "sambal-jsonld";
import {
    isExternalSource,
    loadRemoteFile,
    loadLocalFile,
    normalizeRelativePath
} from "./helpers/data";
import { formatSize, getMimeType, isObjectLiteral, writeBuffer } from "./helpers/util";
import { searchLocalFiles } from "./helpers/data";
import { log } from "./helpers/log";
import { URL } from "url";

type ImageTransform = {
    src: string | string[],
    width?: number,
    height?: number,
    encodingFormat?: string
    thumbnail?: {
        name: string,
        width?: number,
        height?: number
    }[]
};

export default class Media {
    private imageTransformMap: Map<string, ImageTransform>;
    private cachedJsonldMap: Map<string, unknown>;
    private publishedMediaPaths: Set<string>;

    constructor(private outputFolder: string, imageTransforms: ImageTransform[]) {
        this.imageTransformMap = new Map<string, ImageTransform>();
        this.cachedJsonldMap = new Map<string, unknown>();
        this.publishedMediaPaths = new Set<string>();
        for (const transform of imageTransforms) {
            const matches = searchLocalFiles(transform.src);
            matches.forEach(filePath => this.imageTransformMap.set(normalizeRelativePath(filePath), transform));
        }
    }

    // src can be either URL or relative path
    async loadImagePath(src: string) {
        const normalSrc = normalizeRelativePath(src);
        // src will have image file extension
        if (this.cachedJsonldMap.has(normalSrc)) {
            return this.cachedJsonldMap.get(normalSrc);
        }

        const imageObj = this.newImageObject(normalSrc);

        if (this.imageTransformMap.has(normalSrc)) {
            await this.transform(normalSrc, imageObj, this.imageTransformMap.get(normalSrc));
        } else {
            await this.transform(normalSrc, imageObj);
        }

        this.cachedJsonldMap.set(normalSrc, imageObj);
        return imageObj;
    }

    async loadImageObject(imageObj: any) {
        // @id does not have image file extension
        if (this.cachedJsonldMap.has(imageObj[JSONLD_ID])) {
            return this.cachedJsonldMap.get(imageObj[JSONLD_ID]);
        }
        if (!imageObj.contentUrl) {
            log.warn(`Image ${imageObj[JSONLD_ID]} does not have a contentUrl`);
        } else {
            imageObj.contentUrl = normalizeRelativePath(imageObj.contentUrl);
            await this.transform(
                imageObj.contentUrl,
                imageObj,
                imageObj
            );
        }
        
        return imageObj;
    }

    private newImageObject(imageUrl: string) {
        return {
            [JSONLD_TYPE]: "ImageObject",
            contentUrl: imageUrl
        };
    }

    private async transform(filePath: string, imageObj: any, transform?: ImageTransform) {
        const output = await this.loadImage(filePath, transform);
        imageObj.encodingFormat = getMimeType(output.info.format);
        imageObj.width = output.info.width;
        imageObj.height = output.info.height;
        imageObj.contentSize = formatSize(output.info.size);
        if (output.isTransformed) {
            imageObj.contentUrl = this.updateContentUrlType(imageObj.contentUrl, output.info.format);
            if (this.publishedMediaPaths.has(imageObj.contentUrl)) {
                log.warn(`Duplicate ${imageObj.contentUrl}`);
            }
            this.publishedMediaPaths.add(imageObj.contentUrl);
            await writeBuffer(`${this.outputFolder}${imageObj.contentUrl}`, output.buffer);
        }
        const thumbnails = this.getThumbnails(transform);
        if (thumbnails.length > 0) {
            const thumbnailJsonLds = [];
            for (const thumbnail of thumbnails) {
                const thumbnailUrl = this.getThumbnailContentUrl(filePath, thumbnail.name, output.info.format);
                const thumbnailJsonLd = this.newImageObject(thumbnailUrl);
                thumbnailJsonLds.push(await this.transform(filePath, thumbnailJsonLd, {
                    src: filePath,
                    width: thumbnail.width,
                    height: thumbnail.height
                }));
            }
            imageObj.thumbnail = thumbnailJsonLds;
        }
        return imageObj;
    }
    
    
    private async loadImage(filePath: string, transform?: ImageTransform): Promise<{info: OutputInfo, buffer: Buffer, isTransformed: boolean}> {
        return new Promise(async (resolve, reject) => {
            try {
                let instance;
                if (isExternalSource(filePath)) {
                    instance = sharp(await loadRemoteFile(filePath));
                } else {
                    instance = sharp(await loadLocalFile(filePath));
                }
                let isTransformed = false;
                if (transform) {
                    if (transform.width || transform.height) {
                        const options = {
                            width: transform.width,
                            height: transform.height
                        };
                        instance.resize(options);
                        isTransformed = true;
                    }
                    if (transform.encodingFormat) {
                        this.transformImage(instance, transform.encodingFormat);
                        isTransformed = true;
                    }
                }

                instance
                .toBuffer((err: Error, buffer: Buffer, info: OutputInfo) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            buffer: buffer,
                            info: info,
                            isTransformed: isTransformed
                        });
                    }
                });
    
            } catch (e) {
                reject(e);
            }
        });
    }
    
    private getThumbnails(transform?: ImageTransform) {
        if (transform && transform.thumbnail) {
            if (Array.isArray(transform.thumbnail)) {
                return transform.thumbnail;
            } else if (isObjectLiteral(transform.thumbnail)) {
                return [transform.thumbnail];
            }
        }
        return [];
    }
    private getThumbnailContentUrl(contentUrl: string, thumbnailName: string, ext: string) {
        return `${path.dirname(contentUrl)}/${thumbnailName}.${ext}`;
    }

    // change file extension to match mime-type, remove protocal if absolute url
    private updateContentUrlType(contentUrl: string, ext: string) {
        let localPath = contentUrl;
        const index = localPath.lastIndexOf(".");
        if (index >= 0) {
            localPath = `${localPath.substring(0, index)}.${ext}`;
        }
        if (isExternalSource(contentUrl)) {
            const myUrl = new URL(contentUrl);
            localPath = `/${localPath.substring(myUrl.protocol.length + 2)}`;
        }
        return localPath;
    }
    
    private transformImage(instance: Sharp, mimeFormat: string) {
        switch (mimeFormat) {
            case "image/jpeg":
                return instance.jpeg();
            case "image/webp":
                return instance.webp();
            case "image/gif":
                return instance.toFormat("gif");
            case "image/png":
                return instance.png();
            default:
                log.error(`Unrecognized mime type: ${mimeFormat}`);
                return instance;
        }
    }
}