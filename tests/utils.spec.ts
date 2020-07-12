import {loadContent, queryData} from "../src/utils";

describe('utils', () => {

    describe('loadContent', () => {
        it('throw exception for unsupported file type', async () => {
            let hasError = false;
            try {
                await loadContent("./tests/post.abc");
            } catch (e) {
                hasError = true;
            }
            expect(hasError).toBeTruthy();
        });
    });

    describe('queryData', () => {
        const data = {
            profile: {
                name: "Jane doe",
                address: {
                    street: "123 main",
                    zip: 1234
                }
            }
        };

        it('get profile', () => {
            const value = queryData(data, "profile");
            expect(value).toStrictEqual(data.profile);
        });

        it('get name', () => {
            const value = queryData(data, "profile.name");
            expect(value).toBe(data.profile.name);
        });

        it('get zip', () => {
            const value = queryData(data, "profile.address.zip");
            expect(value).toBe(data.profile.address.zip);
        });
    });

});