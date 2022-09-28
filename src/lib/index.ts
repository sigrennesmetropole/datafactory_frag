import bytes from 'bytes';
import {
  createChunks,
  writeChunk,
  deleteChunk,
  IChunk,
  ITmpChunk,
} from './chunks';
import { IDriver } from './drivers';
import { clearLogLine } from './utils';
export * from './config';
export * from './drivers';
export interface IResult {
  done: IChunk[];
  incomplete: ITmpChunk[];
}

export interface IOptions {
  /** whether or not to delete the source object */
  deleteSrc?: boolean;
  /** source prefix to prepend before object key */
  srcPrefix?: string;
  /** destination prefix to prepend before object key */
  dstPrefix?: string;
  /** if `true` aggregated chunks will be separated by a CRLF instead of a LF */
  crlf?: boolean;
  /** aggregate chunks based on there directory structure (eg. 'prefix_a/*.csv' and 'prefix_b/*.csv' will not be aggregated together if `keepPrefixes = 1`, whith `1` being the depth excluding `srcPrefix` and `filename`) */
  keepPrefixes?: number;
  /** if false, chunks can be smaller than the target max size */
  strictSize?: boolean;
  /** a percentage used to determine whether or not an object is already "bundleable" (using 0.05 means that objects within 5% of the given maxChunkSize will be ignored, cause good enough) */
  threshold?: number;
}

/**
 *
 * @param driver io driver
 * @param src source folder/bucket
 * @param dest destination folder/bucket
 * @param maxChunkSize maximum size in bytes for every chunk
 * @param options cf. IOptions
 */
export async function frag(
  driver: IDriver,
  src: string,
  dest: string,
  maxChunkSize: number,
  {
    deleteSrc = false,
    srcPrefix = '',
    dstPrefix = '',
    crlf = false,
    keepPrefixes = 0,
    strictSize = true,
    threshold = 0.05,
  }: IOptions = {}
): Promise<IResult> {
  console.log(`driver=${driver.info()}`);
  console.log(
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `src=${src}, dst=${dest}, srcPrefix=${srcPrefix}, dstPrefix=${dstPrefix}`
  );
  console.log(
    `chunk=${bytes(
      maxChunkSize
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    )}, deleteSrc=${deleteSrc}, crlf=${crlf}, keepPrefixes=${keepPrefixes}, noStrictSize=${!strictSize}`
  );
  console.log();

  const result: IResult = { done: [], incomplete: [] };

  // reads files from `cfg.bucket_src` and create aggregated chunks in tmp dir
  const chunksIter = createChunks(
    driver,
    src,
    srcPrefix,
    maxChunkSize,
    crlf,
    keepPrefixes,
    strictSize,
    threshold
  );

  

  for await (const chunk of chunksIter) {
    if (chunk.complete) {
      if (chunk.files.length === 1 && src === dest && srcPrefix === dstPrefix) {
        // we are not going to rewrite/delete the src file (only delete tmp chunk)
        await deleteChunk(driver, chunk, false);
        continue;
      }
      // write chunks to `cfg.bucket_dst` and append result
      const dstChunk = await writeChunk(
        driver,
        dest,
        dstPrefix,
        chunk,
        keepPrefixes
      );
      console.log(src)
      clearLogLine();
      console.log(
        `Chunk '${chunk.filepath}' (${bytes(
          chunk.size
        )}) written to '${dstChunk.filepath}'`
      );
      
      await deleteChunk(driver, chunk, deleteSrc);
      result.done.push(dstChunk);
    } else {
      result.incomplete.push(chunk);
    }
  }
  return result;
}
