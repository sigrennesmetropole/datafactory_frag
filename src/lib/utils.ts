import { readFile } from 'fs/promises';
import crypto from 'crypto';
import assert from 'assert';

export async function md5sum(filepath: string): Promise<string> {
  const data = await readFile(filepath);
  return crypto.createHash('md5').update(data).digest('hex');
}

export function fileExtensions(filepath: string): string[] {
  return filepath.split('.').slice(1);
}

/**
 * Random integer generator
 * The maximum is exclusive and the minimum is inclusive
 *
 * @param min inclusive
 * @param max exclusive
 */
export function randomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

export function randomName(length = 12): string {
  // prettier-ignore
  const codes = [
    // ASCII 0-9
    48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
    // ASCII a-z
     97,  98,  99, 100, 101, 102, 103, 104, 105,
    106, 107, 108, 109, 110, 111, 112, 113, 114,
    115, 116, 117, 118, 119, 120, 121, 122,
    // ASCII A-Z
    65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
    76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86,
    87, 88, 89, 90,
  ];

  const chars = [];
  for (let i = 0; i < length; i++) {
    chars.push(codes[randomInt(0, codes.length)]);
  }

  return String.fromCharCode(...chars);
}

export function clearLogLine(): void {
  if (process.stdout.isTTY) {
    process.stdout.cursorTo(0);
    process.stdout.clearLine(0);
  }
}

export function logProgress(msg: string): void {
  if (process.stdout.isTTY) {
    clearLogLine();
    process.stdout.write(msg);
  } else {
    console.log(msg.trimEnd());
  }
}

/**
 * @param currentSize size in bytes
 * @param maxSize expected max size in bytes
 * @param percentage floating point number (between 0.0 and 1.0)
 */
export function roughly(currentSize: number, maxSize: number, percentage: number): boolean {
  assert(percentage >= 0 && percentage <= 1, 'roughly() percentage must be a floating point between 0.0 and 1.0');
  const low = maxSize - (maxSize * percentage);
  return currentSize >= low;
}
