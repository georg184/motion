'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function javascriptFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...javascriptFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith('.js')) result.push(absolute);
  }
  return result;
}

const files = javascriptFiles(ROOT).sort();
for (const file of files) {
  childProcess.execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`JavaScript syntax verified for ${files.length} files.`);
