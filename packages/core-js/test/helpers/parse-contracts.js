const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { resetHardhatContext } = require('hardhat/plugins-testing');

/**
 * Helper function to be able to get the ASTs of a given hardhat project, and
 * after compiling it returns the current running environment to its original state.
 * @param {string} envPath
 */
module.exports = async function parseContracts(envPath) {
  resetHardhatContext();

  const originalChdir = process.cwd();
  process.chdir(envPath);

  const hre = require('hardhat');

  await _silentCompile(hre);

  const fullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();

  const asts = {};

  for (const fullyQualifiedName of fullyQualifiedNames) {
    const buildInfo = await hre.artifacts.getBuildInfo(fullyQualifiedName);

    for (const [sourceName, attributes] of Object.entries(buildInfo.output.sources)) {
      asts[sourceName] = attributes.ast;
    }
  }

  resetHardhatContext();
  process.chdir(originalChdir);

  return { asts };
};

async function _silentCompile(hre) {
  const logCache = console.log;
  console.log = () => {};

  try {
    await hre.run(TASK_COMPILE, { force: true, quiet: true });
  } finally {
    if (logCache) console.log = logCache;
  }
}
