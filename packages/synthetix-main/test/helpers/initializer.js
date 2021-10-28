const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const { TASK_DEPLOY } = require('@synthetixio/deployer/task-names');
const { ethers } = hre;

/**
 * Initializer helper for the sample-project, allows to deploy and initialize
 * the project on the given hardhat environment
 * @param {import('hardhat/types').HardhatRuntimeEnvironment}
 */
module.exports = function createInitializer(hre) {
  const deploymentInfo = {
    network: hre.config.defaultNetwork,
    instance: 'test',
  };

  return {
    deploymentInfo,

    async deploySystem(customOptions = {}) {
      await hre.run(TASK_DEPLOY, {
        ...deploymentInfo,
        noConfirm: true,
        quiet: true,
        ...customOptions,
      });
    },

    async initSystem() {
      const proxyAddress = getProxyAddress(deploymentInfo);

      const [owner] = await ethers.getSigners();

      await _initializeOwnerModule(proxyAddress, owner);
    },
  };

  async function _initializeOwnerModule(proxyAddress, owner) {
    const { ethers } = hre;

    let tx;

    const OwnerModule = await ethers.getContractAt('OwnerModuleMock', proxyAddress);

    tx = await OwnerModule.connect(owner).nominateNewOwner(owner.address);
    await tx.wait();

    tx = await OwnerModule.connect(owner).acceptOwnership();
    await tx.wait();
  }
};
