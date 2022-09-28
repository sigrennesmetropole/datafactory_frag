import fs_ from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { pipeline, Readable } from 'stream';
import { promisify } from 'util';
import { IDriver, IFile } from '.';

import fs = fs_.promises;
const pipe = promisify(pipeline);

export class FSDriver implements IDriver {
  async listObjects(folder: string, prefix = ''): Promise<IFile[]> {
    const result: IFile[] = [];
    const files = await fs.readdir(folder);
    for (const file of files) {
      if (file.startsWith(prefix)) {
        const fp = path.join(folder, file);
        const stat = await fs.stat(fp);
        result.push({ name: file, size: stat.size });
      }
    }
    return result;
  }

  getObject(folder: string, filename: string): Readable {
    return createReadStream(path.join(folder, filename));
  }

  async writeObject(
    filepath: string,
    targetFolder: string,
    targetName: string,
    prefix = ''
  ): Promise<void> {
    const targetDir = path.join(targetFolder, prefix);
    await fs.mkdir(targetDir, { recursive: true });
    return pipe(
      createReadStream(filepath),
      createWriteStream(path.join(targetDir, targetName))
    );
  }

  async deleteObjects(folder: string, files: IFile[]): Promise<void> {
    for (const file of files) {
      await fs.unlink(path.join(folder, file.name));
    }
  }

  info(): string {
    return 'fs';
  }
}
