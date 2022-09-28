// @ts-check
const { frag, S3Driver } = require('..');
const bytes = require('bytes');

async function main() {
  const result = await frag(
    new S3Driver(
      {
        host: 'URL_TO_SRC_S3',
        access_key: 'YOUR_ACCESS_KEY',
        secret_key: 'YOUR_SECRET_KEY',
      },
      {
        host: 'URL_TO_DST_S3',
        access_key: 'YOUR_ACCESS_KEY',
        secret_key: 'YOUR_SECRET_KEY',
      }
    ),
    'src-bucket',
    'dst-bucket',
    bytes.parse('10MB')
  );
  console.dir(result);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
