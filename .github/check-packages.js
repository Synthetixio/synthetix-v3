/**
 * Check that package-lock.json file does not exist on any package of the workspace
 */

const packageLock = require('../package-lock.json');

// Get the list of all the workspaces
const workspaces = Object.keys(packageLock.packages).filter(
  (name) => name && !name.includes('node_modules/')
);

for (const workspace of workspaces) {
  try {
    console.log(require.resolve(`../${workspace}/package-lock.json`));
    throw new Error(
      "The file $lockfile was found, please delete it and install dependencies using npm's Workspaces functionality\n - More info 👉 https://docs.npmjs.com/cli/v7/using-npm/workspaces"
    );
  } catch (err) {
    // If package-lock.json file is not found is ok!
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
  }
}
