const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');

module.exports = async function initializer(deploymentInfo) {
  const proxyAddress = getProxyAddress(deploymentInfo);
  const [owner] = await hre.ethers.getSigners();

  await _initializeOwnerModule(proxyAddress, owner);
};

async function _initializeOwnerModule(proxyAddress, owner) {
  let tx;

  const OwnerModule = await hre.ethers.getContractAt('CoreOwnerModule', proxyAddress);

  tx = await OwnerModule.connect(owner).nominateNewOwner(owner.address);
  await tx.wait();

  tx = await OwnerModule.connect(owner).acceptOwnership();
  await tx.wait();
}
