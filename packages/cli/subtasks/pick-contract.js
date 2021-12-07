const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_CONTRACT } = require('../task-names');
const prompts = require('prompts');
const chalk = require('chalk');

subtask(SUBTASK_PICK_CONTRACT, 'Pick contract to interact with').setAction(
  async (taskArguments, hre) => {
    const contractNames = Object.keys(hre.deployer.deployment.general.contracts);

    const choices = contractNames.map((contractName) => {
      const contractAddress =
        hre.deployer.deployment.general.contracts[contractName].deployedAddress;

      return { title: `${contractName} ${chalk.gray(contractAddress)}`, value: contractName };
    });

    await prompts([
      {
        type: 'autocomplete',
        message: 'Pick a CONTRACT:',
        choices,
      },
    ], {
      onCancel: (prompt) => {
        process.exit(0);
      },
      onSubmit: (prompt, answer) => {
        hre.cli.contractName = answer;
      },
    });
  }
);
