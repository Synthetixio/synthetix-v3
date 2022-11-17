module.exports = async function initializer({ contracts }) {
  const [owner] = await hre.ethers.getSigners();
  await _initializeOwnerModule(contracts.Proxy.deployedAddress, owner);
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
