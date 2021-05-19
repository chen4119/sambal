import { IResolver, LOCALHOST, FS_PROTO, URI } from "./helpers/constant";
import { URL } from "url";
import HttpResolver from "./resolvers/HttpResolver";
import FileSystemResolver from "./resolvers/FileSystemResolver";
import { normalizeJsonLdId } from "./helpers/data";

type UriMatcher = {
    protocol?: string | string[],
    host?: string | string[],
    uri?: string | string[]
}

export default class UriResolver {
    private resolvers: {matcher: UriMatcher, resolve: (uri: URI) => Promise<any>}[];
    constructor() {
        this.resolvers = [];
    }

    addResolver(matcher: UriMatcher, resolver: IResolver) {
        this.resolvers.push({
            matcher,
            resolve: resolver.resolveUri.bind(resolver)
        });
    }

    set fsResolver(resolver: FileSystemResolver) {
        this.addResolver({protocol: FS_PROTO}, resolver);
    }

    set httpResolver(resolver: HttpResolver) {
        this.addResolver({protocol: ["https", "http"]}, resolver);
    }

    async resolveUri(uriStr: string) {
        const normalizedUriStr = normalizeJsonLdId(uriStr);
        const uri: URI = {
            protocol: FS_PROTO,
            host: LOCALHOST,
            path: normalizedUriStr
        };

        if (!normalizedUriStr.startsWith("/")) {
            const url = new URL(uriStr);
            uri.protocol = url.protocol;
            uri.host = url.host;
            uri.path = url.pathname;
            uri.query = url.searchParams;
        }
        for (const resolver of this.resolvers) {
            if (this.isMatch(resolver.matcher, uri, normalizedUriStr)) {
                return await resolver.resolve(uri);
            }
        }
        throw new Error(`No resolver found for uri ${uriStr}`);
    }

    private isMatch(matcher: UriMatcher, uri: URI, normalizedUriStr: string) {
        return this.matcher(matcher.protocol, uri.protocol) ||
            this.matcher(matcher.host, uri.host) ||
            this.matcher(matcher.uri, normalizedUriStr);
    }

    private matcher(expect: string | string[] | undefined, actual: string) {
        if (expect) {
            return Array.isArray(expect) ? expect.indexOf(actual) >= 0 : expect === actual;
        }
        return false;
    }
}