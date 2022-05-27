const fs = require('fs');
const { task } = require('hardhat/config');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const {
  getDeployment,
  getDeploymentFile,
  getDeploymentExtendedFiles,
} = require('../utils/deployments');
const { TASK_DEPLOY_MULTICALL_ABI, SUBTASK_GET_DEPLOYMENT_INFO } = require('../task-names');

task(
  TASK_DEPLOY_MULTICALL_ABI,
  'Generate a single merged ABI of the Proxy, including all the Modules ABIs'
)
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .addOptionalParam('include', 'optional comma separated modules to include', '')
  .setAction(async ({ instance, include }, hre) => {
    const whitelist = include
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    const info = await hre.run(SUBTASK_GET_DEPLOYMENT_INFO, { instance });

    const deployment = getDeployment(info);
    const deploymentFile = getDeploymentFile(info);
    const deploymentExtendedFiles = getDeploymentExtendedFiles(deploymentFile);

    const abis = JSON.parse(fs.readFileSync(deploymentExtendedFiles.abis));

    const contracts = Object.values(deployment.contracts)
      .filter((c) => c.isModule)
      .filter((c) => {
        if (whitelist.length === 0) return true;
        return (
          whitelist.includes(c.contractName) || whitelist.includes(c.contractFullyQualifiedName)
        );
      });

    const abi = contracts
      .map((c) => {
        const abi = abis[c.contractFullyQualifiedName];
        if (!abi) throw new Error(`ABI not found for "${c.contractFullyQualifiedName}"`);
        return abi;
      })
      .flat();

    console.log(JSON.stringify({ abi }, null, 2));
  });
