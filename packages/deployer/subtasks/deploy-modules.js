const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const chalk = require('chalk');
const { subtask } = require('hardhat/config');
const { readDeploymentFile } = require('../utils/deploymentFile');
const { getSourceModules } = require('../utils/getSourceModules');
const { getContractBytecodeHash } = require('../utils/getBytecodeHash');
const { SUBTASK_DEPLOY_MODULES, SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

let _hre;

/*
 * Deploys all modules found in sources, and stores
 * the new addresses and associated data in the deployment file.
 * */
subtask(SUBTASK_DEPLOY_MODULES).setAction(async ({ force }, hre) => {
  _hre = hre;

  logger.subtitle('Deploying system modules');

  const data = readDeploymentFile({ hre });
  const sources = getSourceModules({ hre });

  const deploymentInfo = await _getDeploymentInfo({ force, data, sources });
  await _printAndConfirm({ deploymentInfo });
  await _deployModules({ deploymentInfo, sources });
});

async function _getDeploymentInfo({ force, data, sources }) {
  const deploymentInfo = {
    deploymentsNeeded: [],
  };

  for (let moduleName of sources) {
    const moduleData = data.modules[moduleName];

    const info = {};

    if (!info.needsDeployment && force) {
      info.needsDeployment = true;
      info.reason = 'force is set to true';
    }

    if (!info.eedsDeployment && _hre.network.name === 'hardhat') {
      info.needsDeployment = true;
      info.reason = 'always deploy in hardhat network';
    }

    if (!info.needsDeployment && !moduleData.deployedAddress) {
      info.needsDeployment = true;
      info.reason = 'no previous deployment found';
    }

    const sourceBytecodeHash = getContractBytecodeHash({
      contractName: moduleName,
      isModule: true,
      hre: _hre,
    });
    const storedBytecodeHash = moduleData.bytecodeHash;
    const bytecodeChanged = sourceBytecodeHash !== storedBytecodeHash;
    if (!info.needsDeployment && bytecodeChanged) {
      info.needsDeployment = true;
      info.reason = 'bytecode changed';
    }

    deploymentInfo[moduleName] = info;

    if (info.needsDeployment) {
      deploymentInfo.deploymentsNeeded.push(moduleName);
    }
  }

  return deploymentInfo;
}

async function _printAndConfirm({ deploymentInfo }) {
  const numDeployments = deploymentInfo.deploymentsNeeded.length;

  if (numDeployments > 0) {
    logger.notice(`${numDeployments} modules need to be deployed:`);
    for (let i = 0; i < deploymentInfo.deploymentsNeeded.length; i++) {
      const moduleName = deploymentInfo.deploymentsNeeded[i];
      logger.notice(`${i + 1}. ${moduleName} - reason: ${deploymentInfo[moduleName].reason}`, 1);
    }
  } else {
    logger.checked('No modules need to be deployed');
  }

  if (numDeployments === 0) {
    return;
  }

  await prompter.confirmAction(`Deploy these modules`);
}

async function _deployModules({ deploymentInfo, sources }) {
  let numDeployedModules = 0;
  for (let moduleName of sources) {
    const info = deploymentInfo[moduleName];

    if (info.needsDeployment) {
      await _hre.run(SUBTASK_DEPLOY_CONTRACT, { contractName: moduleName, isModule: true });

      numDeployedModules++;
    } else {
      logger.checked(`Skipping deployment of ${moduleName}`);
    }
  }

  logger.complete(`Deployed ${numDeployedModules} modules successfully!`);
}
