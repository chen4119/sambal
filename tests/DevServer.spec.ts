import shelljs from "shelljs";
import axios, { AxiosResponse } from "axios";
import Renderer from "../src/Renderer";
import { init, wait } from "./setup";
import DevServer from "../src/DevServer";
import { PAGES_FOLDER, THEME_PREFIX } from "../src/helpers/constant";
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
        renderer = new Renderer(baseUrl, THEME_PREFIX, null, "mock-theme");
        server = new DevServer(classes.uriResolver, classes.media, classes.router, renderer, 3000);
        await server.start();
    });

    afterAll(async () => {
        shelljs.rm("-f", testFile);
        await server.stop();
    })

    it('render html', async () => {
        const response = await axios.get("http://localhost:3000");
        expect(response.data).toMatchSnapshot();
    });

    it('get client bundle', async () => {
        const response = await axios.get("http://localhost:3000/.sambal/theme/client.8eddd7c976d49f038992.js");
        expect(response.data).toMatchSnapshot();
    });

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
    });

});