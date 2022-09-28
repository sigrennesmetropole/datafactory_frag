import path from 'path';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import os from 'os';
import { constants, createGunzip, createGzip } from 'zlib';
import fs from 'fs';
import {
  fileExtensions,
  logProgress,
  clearLogLine,
  md5sum,
  roughly,
} from './utils';
import bytes from 'bytes';
import { IDriver, IFile } from './drivers';

import unlink = fs.promises.unlink;
const pipe = promisify(pipeline);
type ITableRow = [string, string];

export interface IChunk {
  filepath: string;
  size: number;
  bucket: string;
  files: IFile[];
}

export interface ITmpChunk {
  filepath: string;
  size: number;
  complete: boolean;
  bucket: string;
  files: IFile[];
}

export async function* createChunks(
  driver: IDriver,
  folder: string,
  prefix = '',
  maxChunkSize: number,
  crlf: boolean,
  keepPrefixes: number,
  strictSize: boolean,
  threshold: number,
): AsyncGenerator<ITmpChunk> {
  const objects = await driver.listObjects(folder, prefix);
  if (!keepPrefixes) {
    console.log(`Objects in '${path.join(folder, prefix)}':`, objects.length);
    const totalSize = objects.reduce((sum, o) => sum + o.size, 0);
    if (strictSize && totalSize < maxChunkSize) {
      // ignore current chunk because we are in strict mode and the chunk size does not reach maxChunkSize
      console.log(
        ` => objects total size is too small: ${bytes(totalSize)}/${bytes(
          maxChunkSize
        )} (use --no-strict-size to write those chunks)`
      );
      return;
    }
  }

  let hasProgressLog = false;
  let objIndex = 0;
  let currChunk: ITmpChunk | undefined;
  let prevObj: IFile | undefined;
  const rows: ITableRow[] = [];
  for (const obj of objects) {
    const exts = fileExtensions(obj.name);
    const oStream = driver.getObject(folder, obj.name);

    // file is roughly the same size as maxChunkSize: just leave it, it is already fine
    if (roughly(obj.size, maxChunkSize, threshold)) {
      if (hasProgressLog) {
        clearLogLine();
      }
      console.log(
        `Ignoring object '${folder}/${
          obj.name
        }' (its size is already fine = ${bytes(obj.size)})`
      );
      continue;
    }

    // There are 3 possible cases here, whether:
    //  1) this is the first object in the list: we need a brand new chunk
    //  2) 'keepPrefixes' is enabled and the current object has a different
    //     prefix than the previous one: we need to yield the current chunk
    //     and create a new one
    //  3) the current object will make the current chunk size go above the
    //     given 'maxChunkSize': we yield the current chunk, and create a new one
    if (!currChunk) {
      // case 1)
      currChunk = createTmpChunk(folder, exts);
    } else if (keepPrefixes > 0 && !samePrefix(prevObj, obj, keepPrefixes)) {
      // case 2)
      if (hasProgressLog) {
        clearLogLine();
      }

      if (strictSize) {
        // we are in strict-size mode which means that we do not want to write chunks
        // if there is not enough data to reach maxChunkSize
        console.log(
          ` => objects total size is too small: ${bytes(
            currChunk.size
          )}/${bytes(
            maxChunkSize
          )} (use --no-strict-size to write those chunks)`
        );
      } else {
        // not in strict mode: validate chunk and yield it
        completeChunk(currChunk);
      }
      yield currChunk;

      // initiate new chunk
      currChunk = createTmpChunk(folder, exts);
    } else if (currChunk.size + obj.size > maxChunkSize) {
      // case 3)
      if (hasProgressLog) {
        clearLogLine();
      }
      // validate chunk and yield it
      completeChunk(currChunk);
      yield currChunk;

      // initiate new chunk
      currChunk = createTmpChunk(folder, exts);
    }

    // give a graphical update if in a TTY
    if (process.stdout.isTTY) {
      logProgress(
        `${folder}/${obj.name} >> ${currChunk.filepath} (${bytes(currChunk.size)}) [${
          objIndex + 1
        }/${objects.length}]`
      );

      hasProgressLog = true;
    }
    rows.push([
      folder + "/" + obj.name,
      currChunk.filepath,
    ]);

    // add the content of the current object to the current chunk
    await aggregateOnChunk(currChunk, obj, exts, oStream, crlf);

    // update prev object ref
    prevObj = obj;
    objIndex++;
  }
logForFrag(rows);
  stdout({ complete: 1, code: 1, description: `${rows.length} file(s) have been processed.` });

  // once we are done iterating over all the objects, we might still
  // have the last chunk (the current one) to handle, so let's do this:
  if (currChunk && currChunk.size > 0 && !currChunk.complete) {
    if (strictSize) {
      // we are in strict-size mode which means that we do not want to write chunks
      // if there is not enough data to reach maxChunkSize
      console.log(
        ` => objects total size is too small: ${bytes(
          currChunk.size
        )}/${bytes(
          maxChunkSize
        )} (use --no-strict-size to write those chunks)`
      );
    } else {
      // not in strict mode: validate chunk and yield it
      completeChunk(currChunk);
    }
    yield currChunk;
  }

  if (hasProgressLog) {
    clearLogLine();
  }
}

export async function writeChunk(
  driver: IDriver,
  folder: string,
  prefix = '',
  chunk: ITmpChunk,
  keepPrefixes: number
): Promise<IChunk> {
  const date = new Date()         //renvoie une instance de date
  const year = date.getFullYear()+"";
  const month = (date.getMonth()+1)+"";
  const day = date.getDate();
  const week = await day2week(day)
  const preName = "year="+year.padStart(2, '0')+"/month="+month.padStart(2, '0')+"/week="+week.padStart(2, '0')+"/"; // permet d'avoir le chemin avec la date | le padstart permet d'avoir 05 au lieu de 5
  const prehashedName = await md5sum(chunk.filepath);
  const hashedName = preName+prehashedName;
  const extensions = fileExtensions(chunk.filepath);
  const name = `${hashedName}.${extensions.join('.')}`;
  const prefixes = chunk.files[0].name
    .split(path.sep)
    .slice(1, -1)
    .slice(0, keepPrefixes);
  const filename =
  keepPrefixes > 0
  ? path.join(prefix, ...prefixes, name)
  : path.join(prefix, name);
  try {
    await driver.writeObject(chunk.filepath, folder, filename);
    return {
      filepath: path.join(folder, filename),
      size: chunk.size,
      bucket: chunk.bucket,
      files: chunk.files,
    };
  } catch (err) {
    throw new Error(
      `Unable to write chunk to '${path.join(folder, filename)}' (${
        (err as Error).message
      })`
    );
  }
}
/**
 * Permet de savoir selon une date donne, dans quelle semaine du mois on se trouve
 * @param day jour du mois
 * @returns retourne le numéro de semaine (du mois donc entre 1 et 4)
 */
function day2week(day : any ):String{
  var nbWeek
  switch (Math.floor((day-1)/7)) {  // permet de savoir dans quelle semaine on est | -1 pour que le 7e jour soit compte comme semaine 1
    case 0:
      nbWeek = "1"
      break;
    case 1:
      nbWeek = "2"
      break;
    case 2:
      nbWeek = "3"
      break;
    case 3:
      nbWeek = "4"
      break;
    case 4:
      nbWeek = "5"
      break;
  
    default:
      console.error("Error in the number of the week process")
      //process.exit(1)
      nbWeek="error" // TODO que fais-je dans le cas par default ??
      break;
  }
  return nbWeek;
}

export async function deleteChunk(
  driver: IDriver,
  chunk: ITmpChunk,
  deleteSrc: boolean
): Promise<void> {
  try {
    // remove tmp chunk
    await unlink(chunk.filepath);
  } catch (err) {
    throw new Error(
      `Unable to delete tmp chunk '${chunk.filepath}' (${
        (err as Error).message
      })`
    );
  }
  try {
    // remove src objects if needed
    if (deleteSrc) {
      await driver.deleteObjects(chunk.bucket, chunk.files);
      console.log(
        `${chunk.files.length} objects deleted from bucket '${chunk.bucket}'`
      );
    }
  } catch (err) {
    throw new Error(
      `Unable to delete source objects from '${chunk.bucket}' (${
        (err as Error).message
      })`
    );
  }
}

// unless we have more than Number.MAX_SAFE_INTEGER chunks
// we are good to go with a incremental id
// If we **do** have more than Number.MAX_SAFE_INTEGER
// in one execution of `frag`, we have bigger problem than this.
let chunkCount = 0;

function createTmpChunk(bucket: string, extensions: string[]): ITmpChunk {
  const ext = extensions.length === 0 ? 'tgz' : extensions[0];
  const filepath = path.join(
    os.tmpdir(),
    // this entropy should be more than enough
    `frag-chunk-${chunkCount++}.${ext}.gz`
  );
  return {
    filepath,
    size: 0,
    complete: false,
    bucket: bucket,
    files: [],
  };
}

/**
 * Flags a chunk as "complete", meaning that the chunk is ok.
 *
 * @param chunk
 */
function completeChunk(chunk: ITmpChunk) {
  chunk.complete = true;
}

/**
 *
 * @param chunk Chunk to append data to
 * @param objStream Object to read data to append from
 * @param oSize Object size in bytes
 * @param extensions Object extensions list
 */
async function aggregateOnChunk(
  chunk: ITmpChunk,
  file: IFile,
  extensions: string[],
  objStream: Readable,
  crlf: boolean
): Promise<void> {
  const strategies: Array<
    NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream
  > = [];
  for (const ext of extensions.reverse()) {
    switch (ext) {
      case 'gz':
      case 'tgz':
        strategies.push(createGunzip());
        break;

      case 'csv':
      case 'txt':
      case 'json':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strategies.push(ensureNewLine(crlf) as any);
        break;

      default:
        throw new Error(`'${ext}' handling is not implemented yet`);
    }
  }
  await pipe([
    objStream,
    ...strategies,
    createGzip({ flush: constants.Z_NO_FLUSH }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countBytes(chunk) as any,
    fs.createWriteStream(chunk.filepath, { flags: 'a' }),
  ]);
  chunk.files.push(file);
}

function countBytes(chunk: { size: number }) {
  return async function* (source: NodeJS.ReadWriteStream) {
    for await (const data of source) {
      chunk.size += data.length;
      yield data;
    }
  };
}

function ensureNewLine(crlf: boolean) {
  let prevChunk: Buffer | undefined;
  return async function* ensureNewLineGenerator(
    source: NodeJS.ReadWriteStream
  ) {
    if (source) {
      for await (const chunk of source) {
        if (prevChunk) {
          yield prevChunk;
        }
        prevChunk = chunk as Buffer;
      }

      // end-of-stream
      if (prevChunk) {
        let end = prevChunk.length - 1;
        // find first trailing newline (going backward)
        while (prevChunk[end] === 10) {
          // \n
          end--;
          if (prevChunk[end] === 13) {
            // also work with \r\n
            end--;
          }
        }
        // yield the chunk without any newline
        yield prevChunk.slice(0, end + 1);
        // yield the end-of-stream newline
        if (crlf) {
          yield Buffer.from('\r\n');
        } else {
          yield Buffer.from('\n');
        }
      }
    }
  };
}

function samePrefix(a: IFile | undefined, b: IFile, depth: number): boolean {
  if (a === undefined) {
    return true;
  }
  const ap = prefixes(a);
  const bp = prefixes(b);
  let i = 0;
  while (i < depth) {
    if (bp[i] !== ap[i]) {
      return false;
    }
    i++;
  }
  return true;
}

function prefixes(a: IFile): string[] {
  return a.name.split(path.sep).slice(1, -1);
}

function logForFrag(rowsfrag: ITableRow[]) {
  stdout({
    table: {
      title: 'Liste des fichiers traités',
      header: [
        'Url source',
        'Url cible'
      ],
      "rows": rowsfrag.slice(1,10),
    },
  });
}

function stdout(o: any) {
process.stdout.write(`${JSON.stringify(o)}\n`);
}
