const hre = require('hardhat');
const {
  TASK_DEPLOY,
  SUBTASK_GET_MULTICALL_ABI,
  SUBTASK_GET_DEPLOYMENT_INFO,
} = require('@synthetixio/deployer/task-names');

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
module.exports.deploy = async function deploy(chainBuilder) {
  console.log(chainBuilder?.provider);
  if (chainBuilder?.provider) {
    hre.ethers.provider = chainBuilder.provider;
  }

  const info = {
    folder: hre.config.deployer.paths.deployments,
    network: hre.network.name,
  };

  const isHHNetwork = hre.network.name === 'hardhat';
  console.log('netname', hre.network.name);
  await hre.run(TASK_DEPLOY, { noConfirm: true, quiet: false, clear: isHHNetwork });
  console.log('netname', hre.network.name);

  const { abis, info: deployInfo } = await hre.run(SUBTASK_GET_DEPLOYMENT_INFO);

  const contracts = Object.values(deployInfo.contracts).reduce((contracts, c) => {
    if (contracts[c.contractName]) {
      throw new Error(`Contract name repeated: "${c.contractName}"`);
    }

    contracts[c.contractName] = {
      address: c.deployedAddress,
      abi: abis[c.contractFullyQualifiedName],
      deployTxnHash: c.deployTransaction,
    };

    return contracts;
  }, {});

  // Rename Synthetix to Proxy
  contracts.Proxy = contracts.Synthetix;
  delete contracts.Synthetix;

  // Set the multicall ABI on the Proxy
  contracts.Proxy.abi = await hre.run(SUBTASK_GET_MULTICALL_ABI, { info });

  return {
    contracts,
  };
};

if (module == require.main) {
  module.exports.deploy().then(console.log);
}
