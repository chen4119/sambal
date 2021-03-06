import shelljs from "shelljs";
import { getAbsFilePath } from "../src/helpers/util";
import Router from "../src/Router";
import { init, wait } from "./setup";

describe("Router", () => {
    let router: Router;

    beforeEach(async () => {
        const classes = await init();
        router = classes.router;
    });

    it('iterate routes', async () => {
        const pageIterator = router.getPageIterator();
        const pages = [];
        for await (const page of pageIterator) {
            pages.push(page);
        }
        expect(pages.length).toBe(8);
        expect(pages).toMatchSnapshot();
    });

    it('get /', async () => {
        const page = await router.getPage("/");
        expect(page).toMatchSnapshot();
    });

    it('get /blogs/blog1', async () => {
        const page = await router.getPage("/blogs/blog1");
        expect(page).toMatchSnapshot();
    });

    it('get /alias/subfolder/blog1', async () => {
        const page = await router.getPage("/alias/subfolder/blog1");
        expect(page).toMatchSnapshot();
    });

    it('get /archive/2017/1', async () => {
        const page = await router.getPage("/archive/2017/1");
        expect(page).toMatchSnapshot();
    });
    
    it('get /bogus return null', async () => {
        const page = await router.getPage("/bogus");
        expect(page).toBeNull();
    });

    it('get /archive/org-a', async () => {
        const page = await router.getPage("/archive/org-a");
        expect(page).toMatchSnapshot();
    });

});