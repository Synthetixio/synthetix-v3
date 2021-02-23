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

module.exports = {
  getContractBytecodeHash,
};
