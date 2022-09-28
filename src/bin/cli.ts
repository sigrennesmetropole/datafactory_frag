#!/usr/bin/env node
import arg from 'arg';
import fs from 'fs';
import { dirname } from 'path';
import { config } from 'dotenv';
import { parse } from 'bytes';
import { frag, configFromEnv, S3Driver, IDriver, FSDriver } from '../lib';
import { NAME, VERSION } from './constants';

import mkdir = fs.promises.mkdir;
import writeFile = fs.promises.writeFile;

// loads `process.env` variables from `.env` if any
config();

function showHelp() {
  console.log();
  console.log(
    ' frag: File Reaper AGgregator: aggregates files into size-controlled chunks'
  );
  console.log();
  console.log('   USAGE:');
  console.log(
    '     -c, --chunk:         The maximum size of the chunks (eg: 1000, 1kb, 2MB)'
  );
  console.log(
    '     --crlf:              Use CRLF to concatenate chunks (default: LF)'
  );
  console.log(
    `     -d, --driver:        Driver to use to read/write files (default: 'fs', available: 'fs', 's3')`
  );
  console.log(
    '     --delete-src:        If true, the source files will be deleted (transactional)'
  );
  console.log('     -h, --help:          Shows this help message');
  console.log(
    '     --no-strict-size:    If enabled, chunk size can be less than the value specified by -c'
  );
  console.log('     -o, --output:        File to write the results (JSON)');
  console.log(
    '     --keep-prefixes:     Create chunks based on there directory prefixes (default: 0)'
  );
  console.log(
    '     -s, --src:           The source used to read files from (fs: directory, s3: bucket)'
  );
  console.log(
    '     -t, --dst:           The destination used to write chunks to (fs: directory, s3: bucket)'
  );
  console.log(`     --threshold          a percentage used to determine whether or not an object is ok "as-is"
                                       (using 0.05 means that objects within 5% of the given maxChunkSize will be ignored)'
                                       (default: 0.05)`);
  console.log(
    `     -v, --version:       Display the current version of ${NAME}`
  );
  console.log();
}

function showVersion() {
  console.log(VERSION);
}

function createS3Driver(): S3Driver {
  const config = configFromEnv(process.env);
  return new S3Driver(
    {
      host: config.s3_src,
      access_key: config.s3_src_access_key,
      secret_key: config.s3_src_secret_key,
    },
    config.s3_src !== config.s3_dst
      ? {
          host: config.s3_dst,
          access_key: config.s3_dst_access_key,
          secret_key: config.s3_dst_secret_key,
        }
      : undefined
  );
}

function createFSDriver(): FSDriver {
  return new FSDriver();
}

function parseBoolEnv(name: string): boolean | undefined {
  let value = process.env[name];
  if (value) {
    value = value.toLowerCase();
    return (
      value === 'true' || value === '1' || value === 'yes' || value === 'y'
    );
  }
  return undefined;
}

function parseIntEnv(name: string): number | undefined {
  const value = process.env[name];
  if (value) {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      return num;
    }
  }
  return undefined;
}

function parseFloatEnv(name: string): number | undefined {
  const value = process.env[name];
  if (value) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num;
    }
  }
  return undefined;
}

async function main() {
  const args = arg(
    {
      '--chunk': String,
      '-c': '--chunk',
      '--crlf': Boolean,
      '--delete-src': Boolean,
      '--driver': String,
      '-d': '--driver',
      '--dst-prefix': String,
      '--dst': String,
      '-t': '--dst',
      '--help': Boolean,
      '-h': '--help',
      '--keep-prefixes': Number,
      '--no-strict-size': Boolean,
      '--output': String,
      '-o': '--output',
      '--src-prefix': String,
      '--src': String,
      '-s': '--src',
      '--threshold': Number,
      '--version': Boolean,
      '-v': '--version',
    },
    {
      permissive: false, // no unknown arg
      argv: process.argv.slice(2),
    }
  );

  if (
    args['--help'] ||
    (Object.keys(args).length === 1 && args['_'].length === 0)
  ) {
    showHelp();
    process.exit(0);
  }

  if (args['--version']) {
    showVersion();
    process.exit(0);
  }

  let driver: IDriver | undefined;
  const driverSpec = args['--driver'];
  switch (driverSpec) {
    case 's3':
      driver = createS3Driver();
      break;
    case undefined:
    case 'fs':
      driver = createFSDriver();
      break;
    default:
      throw new Error(
        `Unknown driver '${driverSpec}' (available drivers: 's3', 'fs')`
      );
  }

  const src = process.env.SRC || args['--src'];
  if (!src) {
    throw new Error(`Option --src is mandatory (or SRC env)`);
  }
  const dst = process.env.DST || args['--dst'];
  if (!dst) {
    throw new Error(`Option --dst is mandatory (or DST env)`);
  }
  let chunkSize = process.env.CHUNK_SIZE || args['--chunk'];
  if (!chunkSize) {
    chunkSize = '10mb';
  }
  const deleteSrc = parseBoolEnv('DELETE_SRC') ?? args['--delete-src'] ?? false;
  const crlf = parseBoolEnv('CRLF') ?? args['--crlf'] ?? false;
  const keepPrefixes =
    parseIntEnv('KEEP_PREFIXES') ?? args['--keep-prefixes'] ?? 0;
  const noStrictSize =
    parseBoolEnv('NO_STRICT_SIZE') ?? args['--no-strict-size'] ?? false;
  const srcPrefix = process.env.SRC_PREFIX || args['--src-prefix'];
  const dstPrefix = process.env.DST_PREFIX || args['--dst-prefix'];
  const threshold = parseFloatEnv('THRESHOLD') ?? args['--threshold'] ?? 0.0;

  const begin = new Date();
  const results = await frag(driver, src, dst, parse(chunkSize), {
    deleteSrc,
    srcPrefix,
    dstPrefix,
    crlf,
    keepPrefixes,
    strictSize: !noStrictSize,
    threshold,
  });
  const end = new Date();
  console.log();

  const fragResult = {
    begin,
    end,
    results,
  };
  const output = args['--output'];
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(fragResult, null, 2), 'utf-8');
    console.log(`Result written to: ${output}`);
  } else {
    console.dir(fragResult, { depth: Infinity });
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
