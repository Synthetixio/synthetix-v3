const hre = require('hardhat');
const {
  TASK_DEPLOY,
  SUBTASK_GET_MULTICALL_ABI,
  SUBTASK_GET_DEPLOYMENT_INFO,
} = require('@synthetixio/hardhat-router/task-names');

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
module.exports.deploy = async function deploy(runtime, prefix, modules) {
  if (runtime?.provider) {
    console.log('overriding provider');
    hre.ethers.provider = runtime.provider;
  }

  const cachedGetSigners = hre.ethers.getSigners;
  const cachedGetSigner = hre.ethers.getSigner;

  if (runtime?.getDefaultSigner) {
    console.log('overriding signers');
    const defaultSigner = await runtime.getDefaultSigner('deployer', prefix);

    const signers = [
      defaultSigner,
      new hre.ethers.Wallet(
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        runtime.provider
      ),
      new hre.ethers.Wallet(
        '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
        runtime.provider
      ),
      new hre.ethers.Wallet(
        '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
        runtime.provider
      ),
      new hre.ethers.Wallet(
        '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
        runtime.provider
      ),
    ];

    hre.ethers.getSigners = async () => {
      return [...signers];
    };

    hre.ethers.getSigner = async (address) => {
      const signer = signers.find((s) => s.address === address);

      if (!signer) {
        throw new Error(`Invalid signer "${address}"`);
      }

      return signer;
    };
  }

  const instance = prefix.toLowerCase();

  const info = {
    folder: hre.config.router.paths.deployments,
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
  hre.ethers.getSigners = cachedGetSigners;
  hre.ethers.getSigner = cachedGetSigner;

  return {
    contracts,
  };
};

if (module == require.main) {
  module.exports.deploy().then(console.log);
}
