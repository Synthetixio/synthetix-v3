const fs = require('fs');
const { subtask } = require('hardhat/config');
const inquirer = require('inquirer');
const autocomplete = require('inquirer-list-search-prompt');
const { SUBTASK_PICK_CONTRACT } = require('../task-names');

subtask(SUBTASK_PICK_CONTRACT, 'Pick contract to interact with').setAction(
  async (taskArguments, hre) => {
    const contracts = Object.keys(hre.deployer.deployment.general.contracts);

    _prioritizeTarget(contracts, 'Synthetix');

    hre.cli.contract = await _prompt(contracts);
  }
);

function _prioritizeTarget(contracts, itemName) {
  contracts.splice(contracts.indexOf(itemName), 1);
  contracts.unshift(itemName);
}

async function _prompt(contracts) {
  // Set up inquirer with autocomplete plugin i.e. as you type filtering
  inquirer.registerPrompt('autocomplete', autocomplete);

  const { contract } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'contract',
      message: 'Pick a CONTRACT:',
      source: (matches, query) => _searchContracts(contracts, matches, query),
    },
  ]);

  return contract;
}
async function _searchContracts(contracts, matches, query = '') {
  return new Promise((resolve) => {
    resolve(contracts.filter((contract) => contract.toLowerCase().includes(query.toLowerCase())));
  });
}
