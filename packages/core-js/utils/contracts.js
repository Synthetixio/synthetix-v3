const fs = require('fs');
const path = require('path');

function getContractNameFromPath(contractPath) {
  return path.basename(contractPath, '.sol');
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

async function getContractSelectors(contractName) {
  const contract = await hre.ethers.getContractAt(
    contractName,
    '0x0000000000000000000000000000000000000001'
  );

  return contract.interface.fragments.reduce((selectors, fragment) => {
    if (fragment.type === 'function') {
      selectors.push({
        name: fragment.name,
        selector: contract.interface.getSighash(fragment),
      });
    }

    return selectors;
  }, []);
}

module.exports = {
  getContractNameFromPath,
  getAddressBytecodeHash,
  getContractBytecodeHash,
  getContractSelectors,
};
