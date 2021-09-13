const hre = require('hardhat');
const { ethers } = hre;
const { getProxyAddress } = require('../../../../utils/deployments');

async function initializeSystem({ owner }) {
  const proxyAddress = getProxyAddress();

  await _setFirstOwner({ owner, proxyAddress });
}

async function _setFirstOwner({ owner, proxyAddress }) {
  let tx;

  const OwnerModule = await ethers.getContractAt('OwnerModule', proxyAddress);

  tx = await OwnerModule.connect(owner).nominateOwner(owner.address);
  await tx.wait();

  tx = await OwnerModule.connect(owner).acceptOwnership();
  await tx.wait();
}

module.exports = {
  initializeSystem,
};
