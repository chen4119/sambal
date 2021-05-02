import path from "path";
import sharp, { OutputInfo, Sharp } from "sharp";
import { JSONLD_ID, JSONLD_TYPE } from "sambal-jsonld";
import {
    isExternalSource,
    loadRemoteFile,
    loadLocalFile,
    normalizeRelativePath
} from "./helpers/data";
import { formatSize } from "./helpers/util";
import { searchLocalFiles } from "./helpers/data";

type ImageTransform = {
    src: string | string[],
    width?: number,
    height?: number,
    encodingFormat?: string
    thumbnails?: {
        name: string,
        width?: number,
        height?: number
    }[]
};

export default class Media {
    private imageTransformMap: Map<string, ImageTransform>;
    private cachedJsonldMap: Map<string, unknown>;

    constructor(imageTransforms: ImageTransform[]) {
        this.imageTransformMap = new Map<string, ImageTransform>();
        this.cachedJsonldMap = new Map<string, unknown>();
        for (const transform of imageTransforms) {
            const matches = searchLocalFiles(transform.src);
            matches.forEach(filePath => this.imageTransformMap.set(normalizeRelativePath(filePath), transform));
        }
    }

    async loadImagePath(src: string) {
        const normalSrc = normalizeRelativePath(src);
        // src will have image file extension
        if (this.cachedJsonldMap.has(normalSrc)) {
            return this.cachedJsonldMap.get(normalSrc);
        }

        const imageObj = this.newImageObject(normalSrc);
        // imageObj[JSONLD_ID] = normalizeJsonLdId(src);

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
        const normalSrc = normalizeRelativePath(imageObj.contentUrl);
        if (this.imageTransformMap.has(normalSrc)) {
            await this.transform(
                normalSrc,
                imageObj,
                this.imageTransformMap.get(normalSrc)
            );
            this.cachedJsonldMap.set(imageObj[JSONLD_ID], imageObj);
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
        imageObj.encodingFormat = this.getImageMimeType(output.info.format);
        imageObj.width = output.info.width;
        imageObj.height = output.info.height;
        imageObj.contentSize = formatSize(output.info.size);
        if (transform && transform.thumbnails) {
            imageObj.thumbnail = [];
            for (const thumbnail of transform.thumbnails) {
                const thumbnailurl = `${path.dirname(filePath)}/${thumbnail.name}.${output.info.format}`;
                const thumbnailJsonLd = this.newImageObject(thumbnailurl);
                imageObj.thumbnail.push(await this.transform(filePath, thumbnailJsonLd, {
                    src: filePath,
                    width: thumbnail.width,
                    height: thumbnail.height
                }));
            }
        }
        return imageObj;
    }
    
    
    private async loadImage(filePath: string, transform?: ImageTransform): Promise<{info: OutputInfo, buffer: Buffer}> {
        return new Promise(async (resolve, reject) => {
            try {
                let instance;
                if (isExternalSource(filePath)) {
                    instance = sharp(await loadRemoteFile(filePath));
                } else {
                    instance = sharp(await loadLocalFile(filePath));
                }
    
                if (transform) {
                    if (transform.width || transform.height) {
                        const options = {
                            width: transform.width,
                            height: transform.height
                        };
                        instance.resize(options);
                    }
                    if (transform.encodingFormat) {
                        this.transformImage(instance, transform.encodingFormat);
                    }
                }

                instance
                .toBuffer((err: Error, buffer: Buffer, info: OutputInfo) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            buffer: buffer,
                            info: info
                        });
                    }
                });
    
            } catch (e) {
                reject(e);
            }
        });
    }
    
    private getImageMimeType(type: string) {
        switch (type) {
            case "jpeg":
            case "webp":
            case "gif":
            case "png":
                return `image/${type}`;
            default:
                throw new Error(`No mime type defined for ${type}`);
        }
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
                console.error(`Unrecognized mime type: ${mimeFormat}`);
                return instance;
        }
    }
}