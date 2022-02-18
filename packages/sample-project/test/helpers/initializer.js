const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');

module.exports = async function initializer(deploymentInfo, _hre = hre) {
  const proxyAddress = getProxyAddress(deploymentInfo);
  const [owner] = await _hre.ethers.getSigners();

  await _initializeOwnerModule(proxyAddress, owner, _hre);
};

async function _initializeOwnerModule(proxyAddress, owner, hre) {
  let tx;

  const OwnerModule = await hre.ethers.getContractAt(
    'contracts/modules/OwnerModule.sol:OwnerModule',
    proxyAddress
  );

  tx = await OwnerModule.connect(owner).nominateNewOwner(owner.address);
  await tx.wait();

  tx = await OwnerModule.connect(owner).acceptOwnership();
  await tx.wait();
}
