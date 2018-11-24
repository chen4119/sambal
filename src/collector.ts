const gulp = require('gulp');
const through2 = require('through2');
const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
import {UserDefinedCollection, Partition, Chunk, Collection, Sort} from './types';

const MAIN_PARTITION_KEY = "_main_";
const CHUNK_FILE_PREFIX = "chunk_";
const MAX_CHUNK_ENTRIES = 2000;

gulp.on('error', (err) => {
    console.log('error');
    console.log(err);
});

function getIndexFields(collectionDef: UserDefinedCollection) {
    const fieldSet = new Set<string>();
    if (collectionDef.sortBy) {
        for (let i = 0; i < collectionDef.sortBy.length; i++) {
            fieldSet.add(collectionDef.sortBy[i].field);
        }
    }
    if (collectionDef.partitionBy) {
        for (let i = 0; i < collectionDef.partitionBy.length; i++) {
            fieldSet.add(collectionDef.partitionBy[i]);
        }
    }
    if (collectionDef.include) {
        for (let i = 0; i < collectionDef.include.length; i++) {
            fieldSet.add(collectionDef.include[i]);
        }
    }
    return [...fieldSet.values()];
}

function getIndexValues(obj: any, indexFields: string[]) {
    const indexValuesOnly = {};
    for (let i = 0; i < indexFields.length; i++) {
        const fieldName = indexFields[i];
        indexValuesOnly[fieldName] = obj[fieldName];
    }
    return indexValuesOnly;
}

function parseContent(content: string, extname: string) {
    switch (extname) {
        case ".json":
            return JSON.parse(content);
        case ".md":
            return matter(content).data;
        default:
        return null;
    }
}

function addObjToPartition(obj: any, filePath: string, partition: Partition) {
    let chunk: Chunk = null;
    for (let i = 0; i < partition.chunks.length; i++) {
        if (partition.chunks[i].data.length < MAX_CHUNK_ENTRIES) {
            chunk = partition.chunks[i];
            break;
        }
    }
    if (chunk === null) {
        chunk = {
            name: `${CHUNK_FILE_PREFIX}${partition.chunks.length + 1}`,
            data: []
        }
        partition.chunks.push(chunk);
    }
    chunk.data.push({
        meta: obj,
        path: filePath
    });
}

function partition(obj: any, filePath: string, partitionMap: Map<string, Partition>, partitionBy: string[]) {
    let partition: Partition = null;
    let partitionKey = null;
    if (partitionBy) {
        const key = partitionBy
        .map((fieldName) => (typeof(obj[fieldName]) === 'undefined' || obj[fieldName] === null) ? '' : obj[fieldName])
        .join('-');
        console.log(`key:${key}`);
        partitionKey = new Buffer(key).toString('base64');
    } else {
        partitionKey = MAIN_PARTITION_KEY;
    }

    if(partitionMap.has(partitionKey)) {
        partition = partitionMap.get(partitionKey);
    } else {
        partition = {
            key: partitionKey,
            chunks: []
        };
        partitionMap.set(partitionKey, partition);
    }
    addObjToPartition(obj, filePath, partition);
}

function indexFiles(collectionDef: UserDefinedCollection, partitionMap: Map<string, Partition>) {
    const indexFields = getIndexFields(collectionDef);
    return streamToPromise(gulp.src(collectionDef.glob)
        .pipe(through2.obj(function(file, enc, cb) {
            const filePath = `${path.relative(file.base, file.dirname)}/${file.basename}`;
            console.log(filePath);
            const obj = parseContent(file.contents.toString(), file.extname);
            const objWithIndexValuesOnly = getIndexValues(obj, indexFields);
            partition(objWithIndexValuesOnly, filePath, partitionMap, collectionDef.partitionBy);
            cb(null, file);
        })));
}

function isValueValid(val) {
    if (typeof(val) === "string" || typeof(val) === "number" || typeof(val) === "boolean") {
        return true;
    }
    return false;
}

function sortValue(a, b, order) {
    let isAValid = false;
    let compare = 0;
    if (!isValueValid(a) && !isValueValid(b)) {
        compare = 0;
    } else if (isValueValid(a) && !isValueValid(b)) {
        compare = -1;
    } else if (!isValueValid(a) && isValueValid(b)) {
        compare = 1;
    } else {
        if (typeof(a) === "string") {
            compare = a.localeCompare(b);
        } else {
            compare = a - b;
        }
    }
    if (order === 'desc') {
        return compare * -1;
    }
    return compare;
}

function sortPartitions(sortBy: Sort[], partitionMap: Map<string, Partition>) {
    if (!sortBy) {
        return;
    }
    for (const partitionKey of partitionMap.keys()) {
        const partition: Partition = partitionMap.get(partitionKey);
        for (const chunk of partition.chunks) {
            chunk.data.sort((a, b) => {
                let compare = 0;
                for(let i = 0; i < sortBy.length; i++) {
                    const fieldName = sortBy[i].field;
                    compare = sortValue(a.meta[fieldName], b.meta[fieldName], sortBy[i].order);
                    if (compare !== 0) {
                        return compare;
                    }
                }
                return compare;
            });
        }
    }
}

async function savePartitions(collectionDef: UserDefinedCollection, partitionMap: Map<string, Partition>, output: string) {
    const partitions: Partition[] = [];
    for (const partitionKey of partitionMap.keys()) {
        const partition: Partition = partitionMap.get(partitionKey);
        partitions.push({
            ...partition,
            chunks: partition.chunks.map((c) => {
                return {
                    name: c.name
                }
            })
        });
        for (const chunk of partition.chunks) {
            const outputDir = `${output}/${collectionDef.name}/${partitionKey}`;
            shell.mkdir('-p', outputDir);
            await asyncWriteFile(`${outputDir}/${chunk.name}.json`, chunk.data);
        }
    }
    const collectionManifest: Collection = {
        ...collectionDef,
        partitions: partitions
    };
    return asyncWriteFile(`${output}/${collectionDef.name}/manifest.json`, collectionManifest);
}

async function createMasterManifest(collections: UserDefinedCollection[], output: string) {
    const collectionManifests = [];
    await streamToPromise(gulp.src(`${output}/**/manifest.json`)
        .pipe(through2.obj(function(file, enc, cb) {
            const manifest = parseContent(file.contents.toString(), file.extname);
            collectionManifests.push(manifest);
            cb(null, file);
        })));
    await asyncWriteFile(`${output}/manifest.json`, collectionManifests);
}

function goCollect(collectionDef: UserDefinedCollection, output: string) {
    const partitionMap = new Map<string, Partition>();
    const indexFilesTask = () => indexFiles(collectionDef, partitionMap);
    const sortTask = (cb) => {
        sortPartitions(collectionDef.sortBy, partitionMap);
        cb();
    };
    const saveTask = () => savePartitions(collectionDef, partitionMap, output);
    
    return new Promise(function(resolve, reject) {
        gulp.series(indexFilesTask, sortTask, saveTask)(() => {
            resolve();
        });
    });
}

export async function collect(collections: UserDefinedCollection[], output: string) {
    const promises = [];
    for (let i = 0; i < collections.length; i++) {
        promises.push(goCollect(collections[i], output));
    }
    await Promise.all(promises);
    await createMasterManifest(collections, output);
}

function asyncWriteFile(outputPath: string, content) {
    return new Promise(function(resolve, reject) {
        fs.writeFile(outputPath, JSON.stringify(content), 'utf8', function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function streamToPromise(stream) {
    return new Promise(function(resolve, reject) {
        stream.on('finish', () => {
            resolve();
        });
    });
}
