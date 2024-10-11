#!/usr/bin/env node

const path = require('node:path');
const { fgReset, fgRed, fgGreen, fgCyan } = require('./lib/colors');
const { execSync } = require('node:child_process');

// ignore certain deps that are explicitly mismatched versions
function ignored({ parent, name, absolutePath }) {
  const packageJson = require(`${absolutePath}/package.json`);
  const ignoreMismatched = packageJson?.depcheck?.ignoreMismatched ?? [];
  return parent === packageJson.name && ignoreMismatched.includes(name);
}

async function run() {
  const workspaces = await require('./lib/workspaces')();
  const ROOT = await require('./lib/exec')('yarn workspace synthetix-v3 exec pwd');

  const { unique, mismatched: mismatchedUnfiltered } = workspaces
    .flatMap((p) => {
      const location = path.join(ROOT, p.location);
      const packageJson = require(`${location}/package.json`);
      const { dependencies, devDependencies } = packageJson;
      return Object.entries(dependencies || {})
        .map(([name, version]) => [name, version, p])
        .concat(Object.entries(devDependencies || {}).map(([name, version]) => [name, version, p]));
    })
    .sort((a, b) => b[1].localeCompare(a[1])) // latest version first, sort DESC
    .sort((a, b) => a[0].localeCompare(b[0])) // package name sorted ASC
    .reduce(
      (result, [name, version, context]) => {
        if (version === 'latest') {
          // Disallow "latest"
          result.mismatched.push({
            parent: context.name,
            location: context.location,
            absolutePath: path.join(ROOT, context.location),
            name,
            version,
            //            expected: '^<EXACT VERSION>',
            expected: '<EXACT VERSION>', // exact version
          });
          return result;
        }
        if (name in result.unique && version === result.unique[name]) {
          // Keep only unique
          return result;
        }
        if (name in result.unique && version !== result.unique[name]) {
          result.mismatched.push({
            parent: context.name,
            location: context.location,
            absolutePath: path.join(ROOT, context.location),
            name,
            version,
            expected: result.unique[name],
          });
          return result;
        }
        result.unique[name] = version;
        return result;
      },
      { unique: {}, mismatched: [] }
    );

  const mismatched = mismatchedUnfiltered.filter((item) => !ignored(item));

  for (const { parent, name, version } of mismatched) {
    console.log(
      '⚠️ Dependency version mismatch',
      `${fgRed}"${name}@${version}"${fgReset} found in ${fgCyan}${parent}${fgReset}`,
      `(another version found ${fgGreen}${unique[name]}${fgReset})`
    );
  }

  if (mismatched.length > 0) {
    console.log('');
    console.log(`${fgRed}Versions need fixing: ${fgGreen}${mismatched.length}${fgReset}`);

    if (process.argv.includes('--fix')) {
      console.log(`${fgCyan}Running fix...${fgReset}`);

      for (const { absolutePath, name, expected } of mismatched) {
        console.log(`Fixing ${name} in ${absolutePath}`);
        execSync(`yarn add ${name}@${expected}`, { cwd: absolutePath, stdio: 'inherit' });
      }

      console.log(`${fgGreen}All mismatches fixed.${fgReset}`);
    } else {
      console.log(`${fgCyan}Run with --fix to automatically fix mismatches.${fgReset}`);
      throw new Error(`Versions need fixing: ${mismatched.length}`);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
