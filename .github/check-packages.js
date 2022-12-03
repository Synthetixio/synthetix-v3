/**
 * Check that package-lock.json file does not exist on any package of the workspace
 */

const packageLock = require('../package-lock.json');

// Get the list of all the workspaces
const workspaces = Object.keys(packageLock.packages).filter(
  (name) => name && !name.includes('node_modules/')
);

for (const workspace of workspaces) {
  console.log(require.resolve(`../${workspace}/package.json`));
}

// for workspace in $(find packages/* -type d -maxdepth 0)
// do
//   lockfile="$workspace/package-lock.json"
//   if [ -f "$lockfile" ]; then
//     echo "The file $lockfile was found, please delete it and install dependencies using npm's Workspaces functionality"
//     echo ' - More info 👉 https://docs.npmjs.com/cli/v7/using-npm/workspaces'
//     exit 1
//   fi
// done
