import axios, { AxiosResponse } from "axios";
import Renderer from "../src/Renderer";
import { init } from "./setup";
import DevServer from "../src/DevServer";

describe("Renderer", () => {
    let renderer: Renderer;
    let server: DevServer;

    beforeAll(async () => {
        const classes = await init();
        renderer = new Renderer(null, "mock-theme");
        await renderer.initTheme();
        server = new DevServer(classes.router, renderer, 3000);
        server.start();
    });

    afterAll(() => {
        server.stop();
    })

    it('render html', async () => {
        const response = await axios.get("http://localhost:3000");
        expect(response.data).toMatchSnapshot();
    });

    it('get client bundle', async () => {
        const response = await axios.get("http://localhost:3000/_theme/client.123.js");
        expect(response.data).toMatchSnapshot();
    });



});