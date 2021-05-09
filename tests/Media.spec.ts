import shelljs from "shelljs";
import Media from "../src/Media";
import { CACHE_FOLDER } from "../src/helpers/constant";

describe("Media", () => {
    let media: Media;

    const transforms = [
        {
            src: "images/image2.jpg",
            width: 500,
            encodingFormat: "image/webp"
        }
    ];

    beforeEach(async () => {
        media = new Media(CACHE_FOLDER, transforms);
    });

    afterEach(async () => {
        shelljs.rm("-rf", CACHE_FOLDER);
    });

    it('load local image path', async () => {
        const result = await media.loadImagePath("images/image2.jpg");
        expect(shelljs.test('-f', `${CACHE_FOLDER}/images/image2.webp`)).toBeTruthy();
        expect(result).toMatchSnapshot();
    });

    it('load local image object', async () => {
        const result = await media.loadImageObject({
            "@type": "ImageObject",
            contentUrl: "images/image2.jpg",
            name: "My Background",
            thumbnail: [
                {
                    name: "background50",
                    height: 50
                }
            ]
        });
        expect(shelljs.test('-f', `${CACHE_FOLDER}/images/background50.jpeg`)).toBeTruthy();
        expect(result).toMatchSnapshot();
    });



});