import Router from "../src/Router";
import { init } from "./setup";
import { Collection } from "../src/helpers/constant";

describe("Router", () => {
    let router: Router;

    const collections: Collection[] = [
        {
            uri: "/collections/tags",
            match: ["/blogs/**/*"],
            groupBy: (mainEntity) => {
                return mainEntity.keywords.map(tag => ({
                    tag: tag
                }));
            },
            sort: (a, b) => {
                return a.position - b.position;
            }
        },
        {
            uri: "/collections/year",
            match: ["/blogs/**/*"],
            groupBy: (mainEntity) => {
                return {
                    year: mainEntity.dateCreated.getFullYear()
                }
            },
            sort: (a, b) => {
                return a.dateModified.getTime() - b.dateModified.getTime();
            }
        }
    ];

    beforeEach(async () => {
        const classes = init(collections, []);
        router = classes.router;
    });

    it('iterate routes', async () => {
        const routeIterator = router.getPageIterator();
        let count = 0;
        for await (const route of routeIterator) {
            count ++;
        }
        expect(count).toBe(4);
    });

    it('get /', async () => {
        const page = await router.getPage("/");
        expect(page).toMatchSnapshot();
    });

    it('get /blogs/blog1', async () => {
        const page = await router.getPage("/blogs/blog1");
        expect(page).toMatchSnapshot();
    });

    it('get /alias/blog1', async () => {
        const page = await router.getPage("/alias/blog1");
        expect(page).toMatchSnapshot();
    });

    it('get /bogus return null', async () => {
        const page = await router.getPage("/bogus");
        expect(page).toBeNull();
    });
});