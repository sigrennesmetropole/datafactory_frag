// @ts-check
const os = require('os');
const path = require('path');
const bytes = require('bytes');
const { frag, FSDriver } = require('..');

async function main() {
  const target = os.tmpdir();
  const result = await frag(
    new FSDriver(),
    path.join(__dirname, '..', 'test', 'fixtures', 'csv'),
    target,
    bytes.parse('250KB')
  );
  console.dir(result);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});