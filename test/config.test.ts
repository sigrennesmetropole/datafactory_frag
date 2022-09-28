import { config, configFromEnv } from '../src/lib';

test('invalid config', () => {
  expect(() => config({})).toThrow();
});

test('invalid configFromEnv', () => {
  expect(() => configFromEnv(process.env)).toThrow();
});

test('configFromEnv only SRC', () => {
  const env = {
    S3_SRC: 'url',
    S3_SRC_ACCESS_KEY: 'access',
    S3_SRC_SECRET_KEY: 'secret',
  };
  const c = configFromEnv(env);
  expect(c.s3_src).toEqual(env.S3_SRC);
  expect(c.s3_src_access_key).toEqual(env.S3_SRC_ACCESS_KEY);
  expect(c.s3_src_secret_key).toEqual(env.S3_SRC_SECRET_KEY);
  expect(c.s3_dst).toEqual(env.S3_SRC);
  expect(c.s3_dst_access_key).toEqual(env.S3_SRC_ACCESS_KEY);
  expect(c.s3_dst_secret_key).toEqual(env.S3_SRC_SECRET_KEY);
});