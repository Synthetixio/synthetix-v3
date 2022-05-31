const { subtask } = require('hardhat/config');
const { getDeployment, getDeploymentAbis } = require('../utils/deployments');
const { SUBTASK_GET_MULTICALL_ABI } = require('../task-names');

subtask(
  SUBTASK_GET_MULTICALL_ABI,
  'Generate a single merged ABI of the Proxy, including all the Modules ABIs'
).setAction(async ({ info, whitelist = [] }) => {
  const deployment = getDeployment(info);
  const abis = getDeploymentAbis(info);

  const contracts = Object.values(deployment.contracts)
    .filter((c) => c.isModule)
    .filter((c) => {
      if (whitelist.length === 0) return true;
      return whitelist.includes(c.contractName) || whitelist.includes(c.contractFullyQualifiedName);
    });

  const abi = contracts
    .map((c) => {
      const abi = abis[c.contractFullyQualifiedName];
      if (!abi) throw new Error(`ABI not found for "${c.contractFullyQualifiedName}"`);
      return abi;
    })
    .flat()
    .filter((a, index, abi) => {
      if (index === 0) return true;
      const alreadyExists = abi
        .slice(0, index - 1)
        .some((b) => b.name === a.name && b.type === a.type);
      return !alreadyExists;
    });

  return abi;
});
