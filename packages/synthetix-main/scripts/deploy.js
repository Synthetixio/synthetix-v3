const fs = require('fs');
const { TASK_DEPLOY } = require('@synthetixio/deployer/task-names');

const hre = require('hardhat');

const {
  getAllDeploymentFiles,
  getDeploymentExtendedFiles
} = require('@synthetixio/deployer/utils/deployments');

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
module.exports.deploy = async function() {
  const isHHNetwork = hre.network.name === 'hardhat';
  await hre.run(TASK_DEPLOY, { noConfirm: true, quiet: true, clear: isHHNetwork });

  // deployer leaves its result in JSON files. We only care about the current and "extension"
  const [currentDeploymentFile] = getAllDeploymentFiles();
  const extendedFile = getDeploymentExtendedFiles(currentDeploymentFile);
    
  const deploymentInfo = JSON.parse(fs.readFileSync(currentDeploymentFile));
  const abiInfo = JSON.parse(fs.readFileSync(extendedFile.abis));
  const deployerContracts = deploymentInfo.contracts;

  // send it to cannon
  const contracts = {};

  const proxyAbi = [];

  for (const c in deployerContracts) {
    const deployerInfo = deployerContracts[c];

    for (const abiEntry of abiInfo[c]) {
      if (!proxyAbi.find(e => e.name === abiEntry.name)) {
        proxyAbi.push(abiEntry);
      }
    }

    const contractName = c.indexOf(':') !== -1 ? c.split(':')[1] : c;

    contracts[contractName] = {
      address: deployerInfo.deployedAddress,
      abi: abiInfo[c],
      deployTxnHash: deployerInfo.deployTransaction,
    };
  }

  contracts.Synthetix.abi = proxyAbi;
  contracts.Proxy = contracts.Synthetix;
  delete contracts.Synthetix;

  return {
    contracts
  };
};

if (module == require.main) {
  module.exports.deploy().then(console.log);
}