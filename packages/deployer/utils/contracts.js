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

async function alreadyDeployed(contractPath, contractData) {
  if (!contractData.deployedAddress) return false;

  const sourceBytecodeHash = getContractBytecodeHash(contractPath);
  const remoteBytecodeHash = await getAddressBytecodeHash(contractData.deployedAddress);

  return sourceBytecodeHash === remoteBytecodeHash;
}

/**
 * Sort contracts by the ones that doesn't need deployment, the ones that are going
 * to be re-deployed with updated code, and the ones that are going to be deployed
 * for the first time.
 */
async function processContracts(contracts) {
  const toSkip = [];
  const toUpdate = [];
  const toCreate = [];

  for (const [contractPath, contractData] of Object.entries(contracts)) {
    if (hre.network.name === 'hardhat' || !contractData.deployedAddress) {
      toCreate.push([contractPath, contractData]);
    } else {
      if (await alreadyDeployed(contractPath, contractData)) {
        toSkip.push([contractPath, contractData]);
      } else {
        toUpdate.push([contractPath, contractData]);
      }
    }
  }

  return { toSkip, toUpdate, toCreate };
}

module.exports = {
  getContractNameFromPath,
  getAddressBytecodeHash,
  getContractBytecodeHash,
  getContractSelectors,
  alreadyDeployed,
  processContracts,
};
