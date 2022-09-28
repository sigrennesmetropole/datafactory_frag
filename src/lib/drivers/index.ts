import { Readable } from 'stream';

export interface IFile {
  name: string;
  size: number;
}

export interface IDriver {
  /**
   * Lists files from a given `folder`
   * @param folder 
   * @param prefix optional prefix to be matched for each files
   */
  listObjects(folder: string, prefix?: string): Promise<IFile[]>;

  /**
   * Returns a Readable stream from a (`folder`, `filename`)
   * @param folder 
   * @param filename 
   */
  getObject(folder: string, filename: string): Readable;

  /**
   * Writes the content of `filepath` to (`folder`, `filename`)
   * @param filepath 
   * @param folder 
   * @param filename 
   * @param prefix optional prefix to be prepended to filename
   */
  writeObject(filepath: string, folder: string, filename: string, prefix?: string): Promise<void>;

  /**
   * Deletes all files from `folder` matching `files`
   * @param folder 
   * @param filenames 
   */
  deleteObjects(folder: string, files: IFile[]): Promise<void>;

  /**
   * Prints out driver info
   */
  info(): string;
}

export * from './fs-driver';
export * from './s3-driver';