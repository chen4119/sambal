
type LinkTuple = [string, string];
type LinkMap = Map<string, LinkTuple>;

export default class Links {
    private incomingLinks: Map<string, LinkMap> = new Map<string, LinkMap>();
    private outgoingLinks: Map<string, LinkMap> = new Map<string, LinkMap>();

    constructor() {

    }

    getIncomingLinks(iri: string) {
        if (this.incomingLinks.has(iri)) {
            const links = Array.from(this.incomingLinks.get(iri).values());
            return links.map(tuple => ({
                subject: tuple[0],
                predicate: tuple[1]
            }));
        }
        return [];
    }

    getOutgoingLinks(iri: string) {
        if (this.outgoingLinks.has(iri)) {
            const links = Array.from(this.outgoingLinks.get(iri).values());
            return links.map(tuple => ({
                predicate: tuple[0],
                target: tuple[1]
            }));
        }
        return [];
    }

    add(subjectIRI: string, predicateIRI: string, targetIRI: string) {
        if (!subjectIRI || !predicateIRI || !targetIRI) {
            return;
        }
        this.addLinkToMap(this.incomingLinks, targetIRI, [subjectIRI, predicateIRI]);
        this.addLinkToMap(this.outgoingLinks, subjectIRI, [predicateIRI, targetIRI]);
    }

    private addLinkToMap(linkMap: Map<string, LinkMap>, iri: string, tuple:LinkTuple) {
        let tupleMap = linkMap.get(iri);
        if (!tupleMap) {
            tupleMap = new Map<string, LinkTuple>();
            linkMap.set(iri, tupleMap);
        }
        tupleMap.set(this.getLinkTupleKey(tuple), tuple);
    }

    private getLinkTupleKey(tuple: LinkTuple) {
        return `${tuple[0]}${tuple[1]}`;
    }
}