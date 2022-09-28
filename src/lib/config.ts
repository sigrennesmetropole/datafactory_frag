import assert from 'assert';

export interface IConfig {
  s3_src: string;
  s3_src_access_key: string;
  s3_src_secret_key: string;
  s3_dst: string;
  s3_dst_access_key: string;
  s3_dst_secret_key: string;
}

export interface IEnvConfig {
  S3_SRC?: string;
  S3_SRC_ACCESS_KEY?: string;
  S3_SRC_SECRET_KEY?: string;

  S3_DST?: string;
  S3_DST_ACCESS_KEY?: string;
  S3_DST_SECRET_KEY?: string;
}

function validateConfig(config: Partial<IConfig>): IConfig {
  assert(config.s3_src, "'S3_SRC' is mandatory");
  assert(config.s3_src_access_key, "'S3_SRC_ACCESS_KEY' is mandatory");
  assert(config.s3_src_secret_key, "'S3_SRC_SECRET_KEY' is mandatory");

  return {
    // s3 src
    s3_src: config.s3_src,
    s3_src_access_key: config.s3_src_access_key,
    s3_src_secret_key: config.s3_src_secret_key,
    // s3 dst
    s3_dst: config.s3_dst || config.s3_src,
    s3_dst_access_key: config.s3_dst_access_key || config.s3_src_access_key,
    s3_dst_secret_key: config.s3_dst_secret_key || config.s3_src_secret_key,
  };
}

export function configFromEnv(env: IEnvConfig): IConfig {
  const config = {
    s3_src: env['S3_SRC'],
    s3_dst: env['S3_DST'],
    s3_src_access_key: env['S3_SRC_ACCESS_KEY'],
    s3_src_secret_key: env['S3_SRC_SECRET_KEY'],
    s3_dst_access_key: env['S3_DST_ACCESS_KEY'],
    s3_dst_secret_key: env['S3_DST_SECRET_KEY'],
  };
  try {
    return validateConfig(config);
  } catch (err) {
    throw new Error(`Environment variable ${(err as Error).message}`);
  }
}

export function config(values: Partial<IConfig>): IConfig {
  return validateConfig(values);
}
