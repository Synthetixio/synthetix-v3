const hre = require('hardhat');

exports.deploy = async function deploy(contractFullyQualifiedName) {
  const factory = await hre.ethers.getContractFactory(contractFullyQualifiedName);
  const Contract = await factory.deploy();

  return {
    address: Contract.address,
  };
};
