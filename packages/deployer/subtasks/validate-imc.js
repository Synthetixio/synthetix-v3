const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_VALIDATE_IMC } = require('../task-names');

subtask(
  SUBTASK_VALIDATE_IMC,
  'Runs a series of validations against a generated IMCMixin source.'
).setAction(async () => {
  logger.subtitle('Validating IMCMixin');

  const match = Object.entries(hre.deployer.data.contracts.modules).every(
    (module) => module[1].preCalculatedAddress === module[1].deployedAddress
  );

  if (!match) {
    logger.fail('IMCMixin is valid');
    process.exit(-1);
  }
  logger.success('IMCMixin is valid');
});
