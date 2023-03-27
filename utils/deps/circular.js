#!/usr/bin/env node

async function run() {
  const workspaces = await require('./lib/workspaces')();
  const all = workspaces
    .map(({ name, workspaceDependencies }) => ({
      name,
      deps: workspaceDependencies.map(
        (location) => workspaces.find((pkg) => pkg.location === location).name
      ),
    }))
    .reduce((result, { name, deps }) => ({ ...result, [name]: { name, deps, path: [] } }), {});

  const paths = [];
  const cycles = [];

  function walkTree(node) {
    const isCycle = node.path.includes(node.name);
    const path = [...node.path, node.name];
    if (isCycle) {
      cycles.push(path.join(' -> '));
    } else {
      paths.push(path.join(' -> '));
    }
    node.tree = node.deps.map((dep) => ({ ...all[dep], path }));
    if (!isCycle) {
      node.tree.forEach(walkTree);
    }
  }

  Object.values(all).forEach(walkTree);

  const { fgReset, fgRed, fgGreen, fgYellow, fgCyan } = require('./lib/colors');
  console.log(`${fgGreen}Dependency graph: ${fgCyan}${paths.length}${fgReset}`);
  console.log(paths.join('\n'));
  console.log('');

  if (cycles.length > 0) {
    console.log(`${fgRed}Cycles detected: ${fgCyan}${cycles.length}${fgReset}`);
    console.log(`${fgYellow}${cycles.join('\n')}${fgReset}`);
    console.log('');
    throw new Error(`Cycles detected: ${cycles.length}`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
