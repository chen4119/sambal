
export interface UserDefinedCollection {
    name: string;
    glob: string | string[];
    include?: string[];
    sortBy?: Sort[];
    partitionBy?: string[];
}

export interface Manifest {
    collections: Collection[];
}

export interface Collection {
    name: string;
    sortBy?: Sort[];
    partitionBy?: string[];
    partitions: Partition[];
}

export interface Partition {
    key: string;
    chunks: Chunk[];
}

export interface Chunk {
    name: string;
    data?: Entry[];
}

export interface Sort {
    field: string;
    order: "desc" | "asc";
}

export interface Entry {
    meta: any,
    path: string
}
