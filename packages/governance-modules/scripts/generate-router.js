const hre = require('hardhat');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const chunk = require('lodash.chunk');
const { SUBTASK_GENERATE_ROUTER_SOURCE } = require('../../deployer/task-names');

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
exports.generateRouter = async function generateRouter(...modulesData) {
  const modules = {};

  for (const [fullyQualifiedName, deployedAddress] of chunk(modulesData, 2)) {
    const { contractName } = parseFullyQualifiedName(fullyQualifiedName);
    modules[fullyQualifiedName] = { contractName, deployedAddress };
  }

  await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, { modules });
  await hre.run(TASK_COMPILE, { quiet: true });
};
