const fs = require('fs');
const path = require('path');

const rawPkg = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8');
const pkg = JSON.parse(rawPkg);

const filepath = path.join('src', 'bin', 'constants.ts');
const data = `// AUTO-GENERATED FILE from ${__filename}
// DO NOT MODIFY OR EDIT
export const VERSION = '${pkg.version}';
export const NAME = '${pkg.name}';`;

fs.writeFileSync(filepath, data, 'utf-8');