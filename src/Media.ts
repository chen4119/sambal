import sharp, { OutputInfo, Sharp } from "sharp";
import { JSONLD_TYPE, isAbsUri } from "sambal-jsonld";
import { loadLocalFile } from "./helpers/data";
import { formatSize, getMimeType, writeBuffer } from "./helpers/util";
import { log } from "./helpers/log";
import { URLSearchParams } from "url";
import { URI, FILE_PROTOCOL } from "./helpers/constant";

type SharpTransform = {
    width?: number,
    height?: number,
    encodingFormat?: string,
    suffix?: string
};

interface ImageTransform extends SharpTransform {
    thumbnails?: SharpTransform[]
};


//q = quality
// query w=123&h=123&fit=cover&output=webp&q=76&thumbnails=50w
export default class Media {
    private publishedMediaMap: Map<string, OutputInfo>;

    constructor(private baseUrl: string, private outputFolder: string) {
        this.publishedMediaMap = new Map<string, OutputInfo>();
    }

    async loadImage(localUri: string) {
        if (this.publishedMediaMap.has(localUri)) {
            return await loadLocalFile(`${this.outputFolder}/${localUri}`);
        }
        return null;
    }

    async toImageObject(uri: URI, imageBuf: Buffer) {
        const mediaUri = uri.protocol === FILE_PROTOCOL ?
            uri.path : `${uri.protocol}//${uri.host}${uri.path}`;

        const imageJsonLd = this.newImageObject(mediaUri);
        const transform = this.getImageTransform(uri.query);
        if (transform) {
            await this.transform(imageJsonLd, imageBuf, transform);
        } else {
            const output = await this.hydrateImage(imageJsonLd, imageBuf);
            if (!isAbsUri(mediaUri)) {
                this.setLocalContentUrl(imageJsonLd, mediaUri, null);
                if (output) {
                    await this.writeImage(imageJsonLd.contentUrl, output.info, output.buffer);
                }
            }
        }
        return imageJsonLd;
    }

    private getImageTransform(params: URLSearchParams): ImageTransform {
        if (!params) {
            return null;
        }

        const transform: ImageTransform = {
            width: +params.get("w"),
            height: +params.get("h"),
            encodingFormat: getMimeType(params.get("output")),
            thumbnails: this.parseThumbnails(params.get("thumbnails"))
        };
        return this.isValidSharpTransform(transform) && transform.thumbnails.length > 0 ? 
            transform : null;
    }

    private isValidSharpTransform(transform: SharpTransform): transform is SharpTransform {
        return Boolean(transform.width) || 
            Boolean(transform.height) ||
            Boolean(transform.encodingFormat);
    }

    private parseThumbnails(thumbnails: string | null): SharpTransform[] {
        if (thumbnails) {
            return thumbnails.split(",").map(spec => {
                const cleanedSpec = spec.toLowerCase().trim();
                if (cleanedSpec.endsWith("w")) {
                    return {width: +cleanedSpec.substring(0, cleanedSpec.length - 1), suffix: cleanedSpec};
                }
                if (cleanedSpec.endsWith("h")) {
                    return {height: +cleanedSpec.substring(0, cleanedSpec.length - 1), suffix: cleanedSpec};
                }
                return {};
            }).filter(transform => this.isValidSharpTransform(transform));
        }
        return [];
    }

    private async transform(imageJsonLd: any, imageBuf: Buffer, imageTransform: ImageTransform) {
        // With transform, content url always local
        this.setLocalContentUrl(imageJsonLd, imageJsonLd.contentUrl, imageTransform.encodingFormat);
        const output = await this.hydrateImage(imageJsonLd, imageBuf, imageTransform);
        if (output) {
            await this.writeImage(imageJsonLd.contentUrl, output.info, output.buffer);
        }
        if (imageTransform.thumbnails) {
            const thumbnailJsonLds = [];
            for (const thumbnail of imageTransform.thumbnails) {
                const thumbnailUrl = this.toLocalContentUrl(imageJsonLd.contentUrl, imageTransform.encodingFormat, thumbnail.suffix);
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
        if (output) {
            await this.writeImage(thumbnailUrl, output.info, output.buffer);
        }
        this.setLocalContentUrl(thumbnailJsonLd, thumbnailUrl, transform.encodingFormat);
        return thumbnailJsonLd;
    }

    private setLocalContentUrl(imageObject: any, contentUrl: string, mimeType: string) {
        const localUrl = this.toLocalContentUrl(contentUrl, mimeType);
        imageObject.contentUrl = localUrl;
        // Google requires absolute url
        imageObject.url = `${this.baseUrl}${localUrl}`;
    }

    private newImageObject(contentUrl: string): any {
        return {
            [JSONLD_TYPE]: "ImageObject",
            url: contentUrl,
            contentUrl: contentUrl
        };
    }

    // if publishedMediaMap already has contentUrl, use cached output info
    private async hydrateImage(imageJsonLd: any, imageBuf: Buffer, transform?: SharpTransform) {
        let sharpOutputInfo;
        let output;
        if (this.publishedMediaMap.has(imageJsonLd.contentUrl)) {
            sharpOutputInfo = this.publishedMediaMap.get(imageJsonLd.contentUrl);
        } else {
            this.logTransformation(imageJsonLd.contentUrl, transform);
            output = await this.sharpTransform(imageBuf, transform);
            sharpOutputInfo = output.info;
        }
        imageJsonLd.encodingFormat = getMimeType(sharpOutputInfo.format);
        imageJsonLd.width = sharpOutputInfo.width;
        imageJsonLd.height = sharpOutputInfo.height;
        imageJsonLd.contentSize = formatSize(sharpOutputInfo.size);
        return output;
    }

    private logTransformation(imageUri: string, transform?: SharpTransform) {
        if (!transform) {
            return;
        }
        const settings = [];
        if (transform.width) {
            settings.push(`width:${transform.width}`);
        }
        if (transform.height) {
            settings.push(`height:${transform.height}`);
        }
        if (transform.encodingFormat) {
            settings.push(`format:${transform.encodingFormat}`);
        }
        log.info(`Transforming image ${imageUri} -> ${settings.join(", ")}`);
    }

    private async writeImage(contentUrl: string, info: OutputInfo, imageBuf: Buffer) {
        this.publishedMediaMap.set(contentUrl, info);
        console.log("Writing image " + `${this.outputFolder}${contentUrl}`);
        await writeBuffer(`${this.outputFolder}${contentUrl}`, imageBuf);
    }
    
    private async sharpTransform(imageBuf: Buffer, transform?: SharpTransform): Promise<{info: OutputInfo, buffer: Buffer}> {
        return new Promise(async (resolve, reject) => {
            try {
                const instance = sharp(imageBuf);
                if (transform) {
                    if (transform.width || transform.height) {
                        const options: any = {};
                        if (transform.width > 0) {
                            options.width = transform.width;
                        }
                        if (transform.height > 0) {
                            options.height = transform.height;
                        }
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
    private toLocalContentUrl(contentUrl: string, mimeType: string, suffix?: string) {
        let localPath = contentUrl;
        const splitted = localPath.split("/");
        const filenameWithExt = splitted[splitted.length - 1];
        let filename = filenameWithExt;
        let originalExt = "";
        const index = filenameWithExt.lastIndexOf(".");
        if (index >= 0) {
            filename = filenameWithExt.substring(0, index);
            originalExt = filenameWithExt.substring(index + 1);
        }

        let newExt = this.getFileExtension(mimeType);
        if (!newExt) {
            newExt = originalExt;
        }
        if (suffix) {
            splitted[splitted.length - 1] = `${filename}-${suffix}.${newExt}`;
        } else {
            splitted[splitted.length - 1] = `${filename}.${newExt}`;
        }
        localPath = splitted.join("/");

        if (isAbsUri(contentUrl)) {
            const myUrl = new URL(contentUrl);
            localPath = `/${localPath.substring(myUrl.protocol.length + 2)}`;
        }
        return localPath;
    }
    
    private getFileExtension(mimeFormat: string) {
        switch (mimeFormat) {
            case "image/jpeg":
                return "jpg";
            case "image/webp":
                return "webp";
            case "image/gif":
                return "gif";
            case "image/png":
                return "png";
            default:
                return null;
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
                log.error(`Unrecognized mime type: ${mimeFormat}`);
                return instance;
        }
    }
}