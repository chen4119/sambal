import {
    writeFile,
    readFile,
    safeParseJson
} from "./utils";
import path from "path";
import shelljs from "shelljs";

const PARTITION_FILE = "partition.json";
const EMPTY_KEY_PLACEHOLDER = "_empty_";

class Partitions {
    private partitionMap: Map<string, any> = new Map<string, any>();
    private isIndexLoaded: boolean = false;
    constructor(private collectionPath: string, private groupBy?: string[]) {
        
    }

    add(partition: object) {
        const key = this.getKey(partition);
        this.partitionMap.set(key, partition);
    }

    getPartitionKey(partition: object) {
        return this.getKey(partition);
    }

    async list(): Promise<{key: string, meta: any}[]> {
        if (!this.isIndexLoaded) {
            await this.loadIndex();
        }
        return this.getPartitionList();
    }
    
    async flush() {
        const output = this.getPartitionFile();
        const partitions = this.getPartitionList();
        await writeFile(output, JSON.stringify(partitions));
    }

    private async loadIndex() {
        const partitionFile = this.getPartitionFile();
        if (shelljs.test("-e", partitionFile)) {
            const partitions = safeParseJson(await readFile(partitionFile));
            if (partitions) {
                for (const partition of partitions) {
                    this.partitionMap.set(partition.key, partition.meta);
                }
            }
        }
        this.isIndexLoaded = true;
    }

    private getPartitionList(): {key: string, meta: any}[] {
        const partitions = [];
        for (const key of this.partitionMap.keys()) {
            partitions.push({
                key: key,
                meta: this.partitionMap.get(key)
            });
        }
        return partitions;
    }

    private getPartitionFile() {
        return path.join(this.collectionPath, PARTITION_FILE);
    }


    private getKey(partition: object) {
        return encodeURIComponent(this.groupBy.map(f => partition[f] ? partition[f] : EMPTY_KEY_PLACEHOLDER).join("-"));
    }
}

export default Partitions;