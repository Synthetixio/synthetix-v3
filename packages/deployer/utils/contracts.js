const fs = require('fs');
const path = require('path');

function getContractNameFromPath(contractPath) {
  return path.basename(contractPath).replace(new RegExp(/\.sol$/), '');
}

async function getAddressBytecodeHash(address) {
  const bytecode = await hre.ethers.provider.getCode(address);
  return hre.ethers.utils.sha256(bytecode);
}

function getContractBytecodeHash(contractPath) {
  const artifactsPath = hre.config.paths.artifacts;

  const filePath = path.join(
    artifactsPath,
    contractPath,
    `${getContractNameFromPath(contractPath)}.json`
  );

  const data = JSON.parse(fs.readFileSync(filePath));
  return hre.ethers.utils.sha256(data.deployedBytecode);
}

module.exports = {
  getContractNameFromPath,
  getAddressBytecodeHash,
  getContractBytecodeHash,
};
