import sharp, { OutputInfo, Sharp } from "sharp";
import mm from "micromatch";
import { JSONLD_TYPE, isAbsUri } from "sambal-jsonld";
import { normalizeJsonLdId } from "./helpers/data";
import { formatSize, getMimeType, writeBuffer } from "./helpers/util";
import { log } from "./helpers/log";
import { URL } from "url";

type ImageTransform = {
    match: string | string[],
    width?: number,
    height?: number,
    encodingFormat?: string
    thumbnails?: {
        suffix: string,
        width?: number,
        height?: number
    }[]
};

type SharpTransform = {
    width?: number,
    height?: number,
    encodingFormat?: string
};

export default class Media {
    private imageTransformMap: Map<string, ImageTransform>;
    private cachedJsonldMap: Map<string, unknown>;
    private publishedMediaPaths: Set<string>;

    constructor(
        pages: string[],
        data: string[],
        private outputFolder: string,
        imageTransforms: ImageTransform[])
    {
        this.imageTransformMap = new Map<string, ImageTransform>();
        this.cachedJsonldMap = new Map<string, unknown>();
        this.publishedMediaPaths = new Set<string>();
        const localFileUris = [
            ...pages.map(p => normalizeJsonLdId(p)),
            ...data.map(d => normalizeJsonLdId(d))
        ];
        for (const transform of imageTransforms) {
            const matches = mm(localFileUris, transform.match);
            log.debug(`Found images matching ${transform.match}`, matches);
            matches.forEach(uri => this.imageTransformMap.set(normalizeJsonLdId(uri), transform));
        }
    }

    async loadImageUrl(uri: string, imageBuf: Buffer) {
        if (this.cachedJsonldMap.has(uri)) {
            return this.cachedJsonldMap.get(uri);
        }

        const imageJsonLd = this.newImageObject(uri); 
        if (this.imageTransformMap.has(uri)) {
            await this.transform(imageJsonLd, imageBuf, this.imageTransformMap.get(uri));
        } else {
            const output = await this.hydrateImage(imageJsonLd, imageBuf);
            if (!isAbsUri(uri)) {
                imageJsonLd.contentUrl = this.toLocalContentUrl(uri, output.info.format);
                await this.writeImage(imageJsonLd.contentUrl, output.buffer);
            }
        }
        this.cachedJsonldMap.set(uri, imageJsonLd);
        return imageJsonLd;
    }

    private async transform(imageJsonLd: any, imageBuf: Buffer, imageTransform: ImageTransform) {
        const output = await this.hydrateImage(imageJsonLd, imageBuf, {
            width: imageTransform.width,
            height: imageTransform.height,
            encodingFormat: imageTransform.encodingFormat
        });
        imageJsonLd.contentUrl = this.toLocalContentUrl(imageJsonLd.contentUrl, output.info.format);
        await this.writeImage(imageJsonLd.contentUrl, output.buffer);
        if (imageTransform.thumbnails) {
            const thumbnailJsonLds = [];
            for (const thumbnail of imageTransform.thumbnails) {
                const thumbnailUrl = this.toLocalContentUrl(imageJsonLd.contentUrl, output.info.format, thumbnail.suffix);
                const thumbnailJsonLd = await this.generateThumbnail(thumbnailUrl, imageBuf, {
                    width: thumbnail.width,
                    height: thumbnail.height,
                    encodingFormat: imageTransform.encodingFormat
                });
                thumbnailJsonLds.push(thumbnailJsonLd);
            }
            imageJsonLd.thumbnail = thumbnailJsonLds;
        }
    }

    private async generateThumbnail(thumbnailUrl: string, imageBuf: Buffer, transform: SharpTransform) {
        const thumbnailJsonLd = this.newImageObject(thumbnailUrl);
        const output = await this.hydrateImage(thumbnailJsonLd, imageBuf, transform);
        await this.writeImage(thumbnailUrl, output.buffer);
        return thumbnailJsonLd;
    }

    private newImageObject(contentUrl: string): any {
        return {
            [JSONLD_TYPE]: "ImageObject",
            contentUrl: contentUrl
        };
    }

    private async hydrateImage(imageJsonLd: any, imageBuf: Buffer, transform?: SharpTransform) {
        const output = await this.loadImage(imageBuf, transform);
        imageJsonLd.encodingFormat = getMimeType(output.info.format);
        imageJsonLd.width = output.info.width;
        imageJsonLd.height = output.info.height;
        imageJsonLd.contentSize = formatSize(output.info.size);
        return output;
    }

    private async writeImage(contentUrl: string, imageBuf: Buffer) {
        if (this.publishedMediaPaths.has(contentUrl)) {
            log.warn(`Duplicate ${contentUrl}`);
        }
        this.publishedMediaPaths.add(contentUrl);
        await writeBuffer(`${this.outputFolder}${contentUrl}`, imageBuf);
    }
    
    private async loadImage(imageBuf: Buffer, transform?: SharpTransform): Promise<{info: OutputInfo, buffer: Buffer}> {
        return new Promise(async (resolve, reject) => {
            try {
                const instance = sharp(imageBuf);
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

    // change filename and file extension, remove protocol if absolute url
    private toLocalContentUrl(contentUrl: string, ext: string, suffix?: string) {
        let localPath = contentUrl;
        const splitted = localPath.split("/");
        const filenameWithExt = splitted[splitted.length - 1];
        let filename = filenameWithExt;
        const index = filenameWithExt.lastIndexOf(".");
        if (index >= 0) {
            filename = filenameWithExt.substring(0, index);
        }

        if (suffix) {
            splitted[splitted.length - 1] = `${filename}-${suffix}.${ext}`;
        } else {
            splitted[splitted.length - 1] = `${filename}.${ext}`;
        }
        localPath = splitted.join("/");

        if (isAbsUri(contentUrl)) {
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