const path = require('path');
const hre = require('hardhat');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { SUBTASK_GENERATE_ROUTER_SOURCE } = require('../../deployer/task-names');

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
exports.generateRouter = async function generateRouter(modulesData) {
  const modules = JSON.parse(modulesData);

  for (const [fullyQualifiedName, deployedAddress] of Object.entries(modules)) {
    const { contractName } = parseFullyQualifiedName(fullyQualifiedName);
    modules[fullyQualifiedName] = { contractName, deployedAddress };
  }

  await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, { modules });
  await hre.run(TASK_COMPILE, { quiet: true });

  return {
    routerPath: path.join(hre.config.paths.sources, 'Router.sol'),
  };
};
