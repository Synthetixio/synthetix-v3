const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const { TASK_DEPLOY } = require('@synthetixio/deployer/task-names');

/**
 * Initializer helper for the sample-project, allows to deploy and initialize
 * the project on the given hardhat environment
 * @param {import('hardhat/types').HardhatRuntimeEnvironment}
 */
module.exports = function createInitializer(hre) {
  const info = {
    network: hre.config.defaultNetwork,
    instance: 'test',
  };

  return {
    info,

    async deploy(customOptions = {}) {
      await hre.run(TASK_DEPLOY, {
        ...info,
        noConfirm: true,
        quiet: true,
        ...customOptions,
      });
    },

    async init() {
      const { ethers } = hre;

      const proxyAddress = getProxyAddress(info);

      const [owner] = await ethers.getSigners();

      let tx;

      const OwnerModule = await ethers.getContractAt('OwnerModule', proxyAddress);

      tx = await OwnerModule.connect(owner).nominateOwner(owner.address);
      await tx.wait();

      tx = await OwnerModule.connect(owner).acceptOwnership();
      await tx.wait();
    },
  };
};
