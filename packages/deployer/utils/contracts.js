const fs = require('fs');
const path = require('path');

function getContractBytecodeHash({ contractName, isModule = false, hre }) {
  const artifactsPath = hre.config.paths.artifacts;
  const sourcesPath = hre.config.paths.sources;
  const modulesPath = hre.config.deployer.paths.modules;

  const filePath = path.join(
    artifactsPath,
    path.basename(sourcesPath),
    isModule ? path.basename(modulesPath) : '',
    `${contractName}.sol/${contractName}.json`
  );

  const file = fs.readFileSync(filePath);
  const data = JSON.parse(file);

  return hre.ethers.utils.sha256(data.bytecode);
}

async function getContractSelectors({ contractName, hre }) {
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
  getContractBytecodeHash,
  getContractSelectors,
};
