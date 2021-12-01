const { subtask } = require('hardhat/config');
const inquirer = require('inquirer');
const autocomplete = require('inquirer-list-search-prompt');

const { SUBTASK_PICK_FUNCTION, SUBTASK_PICK_CONTRACT } = require('../task-names');
const escItem = '↩ BACK';

subtask(SUBTASK_PICK_FUNCTION, 'Pick a function from the given contract').setAction(
  async (taskArguments, hre) => {
    let contractFunction = escItem;

    while (contractFunction === escItem) {
      // first pick the contract
      await hre.run(SUBTASK_PICK_CONTRACT, taskArguments);
      // the pick-contract subtask will populate the 'contract' envirobmental variable
      const abi = hre.deployer.deployment.abis[hre.cli.contract];
      contractFunction = await _prompt(abi);
    }

    hre.cli.contractFunction = contractFunction;
  }
);

async function _prompt(abi) {
  // Set up inquirer with autocomplete plugin i.e. as you type filtering
  inquirer.registerPrompt('autocomplete', autocomplete);

  const prompt = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'contractFunction',
      message: 'Pick a FUNCTION:',
      source: (matches, query) => _searchAbi(abi, matches, query),
    },
  ]);

  const { contractFunction } = await prompt;

  // if (contractFunction === escItem) {
  //   prompt.ui.close();
  // }

  return contractFunction;
}

async function _searchAbi(abi, matches, query = '') {
  return new Promise((resolve) => {
    let abiMatches = abi.filter((item) => {
      if (item.name && item.type === 'function') {
        return item.name.toLowerCase().includes(query.toLowerCase());
      }
      return false;
    });

    if (query === '') {
      abiMatches.splice(0, 0, escItem);
    }
    resolve(abiMatches);
  });
}
