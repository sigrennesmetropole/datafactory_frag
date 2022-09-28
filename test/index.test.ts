import path from 'path';
import os from 'os';
import fs from 'fs';
import { createHash } from 'crypto';
import * as bytes from 'bytes';
import { frag, FSDriver } from '../src/lib';

// dirty hack to keep test output clean
process.stdout.write = () => true;
// END - dirty hack to keep test output clean

function hash(filepath: string) {
  return createHash('md5').update(fs.readFileSync(filepath)).digest('hex');
}

test('not enough data', async () => {
  const result = await frag(
    new FSDriver(),
    path.join(__dirname, 'fixtures', 'csv'),
    '',
    bytes.parse('2MB'),
  );
  expect(result.done.length).toEqual(0);
});

describe('fs driver', () => {
  test('.csv_gz', async () => {
    const dstFolder = os.tmpdir();
    const result = await frag(
      new FSDriver(),
      path.join(__dirname, 'fixtures', 'csv_gz'),
      dstFolder,
      bytes.parse('35KB'),
      { strictSize: false, crlf: true },
    );

    expect(result.done.length).toEqual(3);
    expect(result.incomplete.length).toEqual(0);
    expect(result.done[0].filepath.endsWith('.csv.gz')).toBeTruthy();
    expect(result.done[1].filepath.endsWith('.csv.gz')).toBeTruthy();
    expect(result.done[2].filepath.endsWith('.csv.gz')).toBeTruthy();
    expect(result.done.map((chunk) => ({
      checksum: hash(chunk.filepath),
      size: chunk.size,
    }))).toEqual([
      { checksum: 'aa1bf7ecc763d6e7c182fe1490308c1e', size: 30209 },
      { checksum: '0f69053e1efddcb96b1450236b29e04d', size: 30244 },
      { checksum: 'e9fa13d390e4f22bec5e0c7f9405f6c3', size: 15195 },
    ]);
  });
});