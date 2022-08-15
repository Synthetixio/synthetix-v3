const hre = require('hardhat');
const {
  TASK_DEPLOY,
  SUBTASK_GET_MULTICALL_ABI,
  SUBTASK_GET_DEPLOYMENT_INFO,
} = require('@synthetixio/deployer/task-names');

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
module.exports.deploy = async function deploy(runtime, prefix, modules) {
  if (runtime?.provider) {
    hre.ethers.provider = runtime.provider;
  }

  if (runtime?.getDefaultSigner) {
    console.log('overriding signers');
    hre.ethers.getSigners = async () => {
      return [await runtime.getDefaultSigner('deployer', prefix)];
    };
    hre.ethers.getSigner = async () => {
      hre.ethers.getSigners()[0];
    };
  }

  const instance = prefix.toLowerCase();

  const info = {
    folder: hre.config.deployer.paths.deployments,
    network: hre.network.name,
    instance,
  };

  const isHHNetwork = hre.network.name === 'hardhat';
  await hre.run(TASK_DEPLOY, {
    noConfirm: true,
    quiet: false,
    clear: isHHNetwork,
    skipProxy: true,
    instance,
    modules,
  });

  const { abis, info: deployInfo } = await hre.run(SUBTASK_GET_DEPLOYMENT_INFO, { instance });

  const contracts = Object.values(deployInfo.contracts).reduce((contracts, c) => {
    // TODO: bug causes proxy contract to be included
    if (c.contractName === 'Proxy') {
      return contracts;
    }

    if (contracts[c.contractName]) {
      throw new Error(`Contract name repeated: "${c.contractName}"`);
    }

    contracts[prefix + c.contractName] = {
      address: c.deployedAddress,
      abi: abis[c.contractFullyQualifiedName],
      deployTxnHash: c.deployTransaction,
    };

    return contracts;
  }, {});

  // Set the multicall ABI on the Proxy
  contracts[prefix + 'Router'].abi = await hre.run(SUBTASK_GET_MULTICALL_ABI, { info, instance });

  return {
    contracts,
  };
};

if (module == require.main) {
  module.exports.deploy().then(console.log);
}
