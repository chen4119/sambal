import Router from "../src/Router";
import { init } from "./setup";

describe("Router", () => {
    let router: Router;

    beforeEach(async () => {
        const classes = init();
        router = classes.router;
    });

    it('iterate routes', async () => {
        const pageIterator = router.getPageIterator();
        const pages = [];
        for await (const page of pageIterator) {
            pages.push(page);
        }
        expect(pages.length).toBe(4);
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

    it('get /bogus return null', async () => {
        const page = await router.getPage("/bogus");
        expect(page).toBeNull();
    });
});