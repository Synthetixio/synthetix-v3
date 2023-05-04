#!/usr/bin/env node

const cp = require('child_process');
const fs = require('fs');

const BAD_VERSION_REGEX = /(\.\d+\+[0-9a-f]+)$/;

cp.execSync('yarn workspaces list --json', {
  encoding: 'utf-8',
  stdio: 'pipe',
})
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .forEach(({ location }) => {
    const packageJson = require(`./${location}/package.json`);
    const cleanVersion = packageJson.version.replace(BAD_VERSION_REGEX, '');
    packageJson.version = cleanVersion;

    if (packageJson.dependencies) {
      Object.keys(packageJson.dependencies).forEach((name) => {
        if (BAD_VERSION_REGEX.test(packageJson.dependencies[name])) {
          packageJson.dependencies[name] = cleanVersion;
        }
      });
    }

    if (packageJson.devDependencies) {
      Object.keys(packageJson.devDependencies).forEach((name) => {
        if (BAD_VERSION_REGEX.test(packageJson.devDependencies[name])) {
          packageJson.devDependencies[name] = cleanVersion;
        }
      });
    }

    fs.writeFileSync(`./${location}/package.json`, `${JSON.stringify(packageJson, null, 2)}\n`);
  });
