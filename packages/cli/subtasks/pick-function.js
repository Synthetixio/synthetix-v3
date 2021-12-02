const { subtask } = require('hardhat/config');
const inquirer = require('inquirer');
const autocomplete = require('inquirer-list-search-prompt');

const { SUBTASK_PICK_FUNCTION } = require('../task-names');

subtask(SUBTASK_PICK_FUNCTION, 'Pick a function from the given contract').setAction(
  async (taskArguments, hre) => {
    const abi = hre.deployer.deployment.abis[hre.cli.contract];
    return await _prompt(abi);
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

  return contractFunction;
}

async function _searchAbi(abi, matches, query = '') {
  const abiMatches = abi.filter((item) => {
    if (item.name && item.type === 'function') {
      return item.name.toLowerCase().includes(query.toLowerCase());
    }

    return false;
  });

  const escItem = '↩ BACK';
  if (query === '') {
    abiMatches.splice(0, 0, escItem);
  }

  return abiMatches;
}
