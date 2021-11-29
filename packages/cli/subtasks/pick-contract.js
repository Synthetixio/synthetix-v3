const fs = require('fs');
const { subtask } = require('hardhat/config');
const inquirer = require('inquirer');
const autocomplete = require('inquirer-list-search-prompt');
const logger = require('@synthetixio/core-js/utils/logger');
const { SUBTASK_PICK_CONTRACT } = require('../task-names');

subtask(SUBTASK_PICK_CONTRACT, 'Pick contract to interact with').setAction(
  async (taskArguments, hre) => {
    logger.info('Pick a contract:');

    const deploymentData = JSON.parse(fs.readFileSync(hre.deployer.paths.deployment));
    const contracts = Object.keys(deploymentData.contracts);

    _prioritizeTarget(contracts, 'Synthetix');

    await _prompt(contracts);
  }
);

function _prioritizeTarget(contracts, itemName) {
  contracts.splice(contracts.indexOf(itemName), 1);
  contracts.unshift(itemName);
}

async function _prompt(contracts) {
  // Set up inquirer
  inquirer.registerPrompt('autocomplete', autocomplete);

  await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'contractName',
      message: 'Pick a CONTRACT:',
      source: (matches, query) => _searchContracts(contracts, matches, query),
    },
  ]);
}
async function _searchContracts(contracts, matches, query = '') {
  return new Promise((resolve) => {
    resolve(contracts.filter((contract) => contract.toLowerCase().includes(query.toLowerCase())));
  });
}
