const chalk = require('chalk');
const { subtask } = require('hardhat/config');
const autocomplete = require('../internal/autocomplete');
const { SUBTASK_PICK_CONTRACT, SUBTASK_FIND_CONTRACTS } = require('../task-names');

subtask(SUBTASK_PICK_CONTRACT, 'Pick contract to interact with').setAction(
  async (taskArguments, hre) => {
    const contracts = await hre.run(SUBTASK_FIND_CONTRACTS);

    const choices = contracts.map((data) => {
      return {
        title: [data.contractName, chalk.gray(data.contractDeployedAddress)].join(' '),
        value: data,
      };
    });

    const result = await autocomplete({
      message: 'Pick a CONTRACT:',
      choices,
    });

    if (result) {
      hre.cli.contractFullyQualifiedName = result.contractFullyQualifiedName;
      hre.cli.contractDeployedAddress = result.contractDeployedAddress;
    } else {
      // Cancelling exits CLI
      process.exit(0);
    }
  }
);
