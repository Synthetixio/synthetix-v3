const { getProxyAddress } = require('@synthetixio/hardhat-router/utils/deployments');

module.exports = async function initializer(deploymentInfo) {
  const proxyAddress = getProxyAddress(deploymentInfo);
  const [owner] = await hre.ethers.getSigners();

  await _initializeOwnerModule(proxyAddress, owner);
};

async function _initializeOwnerModule(proxyAddress, owner) {
  let tx;

  const OwnerModule = await hre.ethers.getContractAt(
    'contracts/modules/OwnerModule.sol:OwnerModule',
    proxyAddress
  );

  tx = await OwnerModule.connect(owner).initializeOwnerModule(owner.address);
  await tx.wait();
}
