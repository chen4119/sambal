import shelljs from "shelljs";
import axios, { AxiosResponse } from "axios";
import Renderer from "../src/Renderer";
import { init, wait } from "./setup";
import DevServer from "../src/DevServer";
import { PAGES_FOLDER, DEVSERVER_BROWSER } from "../src/helpers/constant";
import { writeText, getAbsFilePath } from "../src/helpers/util";

const originalTestBlog = `
---
"@type": BlogPosting
headline: Test blog
---

Hello world3
`;

const modifiedTestBlog = `
---
"@type": BlogPosting
headline: Test blog changed!
---

Hello world3
`;

describe("DevServer", () => {
    let renderer: Renderer;
    let server: DevServer;
    const baseUrl = "https://example.com";
    const testFile = getAbsFilePath(`${PAGES_FOLDER}/testblog.md`);

    beforeAll(async () => {
        await writeText(testFile, originalTestBlog);
        const classes = await init();
        renderer = new Renderer(baseUrl, DEVSERVER_BROWSER, null, "mock-theme");
        server = new DevServer(classes.media, classes.router, renderer, 3000);
        await server.start();
    });

    afterAll(async () => {
        shelljs.rm("-f", testFile);
        await server.stop();
    })

    it('render html', async () => {
        const response = await axios.get("http://localhost:3000");
        let result = await axios.get("http://localhost:3000/.sambal/_dev_server_/browser/js/main.293fadc7a9afe94294c6.js");
        expect(result.status).toBe(200);
        result = await axios.get("http://localhost:3000/.sambal/_dev_server_/browser/mock-theme/theme.Lpjvzyneslx4vFRCS_x-VHb_rf0.css");
        expect(result.status).toBe(200);
        expect(response.data).toMatchSnapshot();
    });

    /*
    it('refresh data on file change', async () => {
        let response = await axios.get("http://localhost:3000/testblog");
        await writeText(testFile, modifiedTestBlog);
        await wait();
        response = await axios.get("http://localhost:3000/testblog");
        expect(response.data).toMatchSnapshot();
    });

    it('get original image2', async () => {
        const response = await axios.get("http://localhost:3000/data/images/image2.jpg");
        expect(response.status).toBe(200);
    });

    it('get image2 as webp and thumbnail', async () => {
        // load blog2 will trigger transformation of images
        let response = await axios.get("http://localhost:3000/blogs/blog2");
        
        response = await axios.get("http://localhost:3000/data/images/image2.webp");
        expect(response.status).toBe(200);
        response = await axios.get("http://localhost:3000/data/images/image2-50w.webp");
        expect(response.status).toBe(200);
    });*/

});