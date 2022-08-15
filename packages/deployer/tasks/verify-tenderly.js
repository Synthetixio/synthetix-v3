const { task } = require('hardhat/config');
const { HardhatPluginError } = require('hardhat/plugins');
const { default: logger } = require('@synthetixio/core-js/dist/utils/io/logger');
const types = require('@synthetixio/core-js/dist/utils/hardhat/argument-types');
const { SUBTASK_LOAD_DEPLOYMENT, TASK_DEPLOY_VERIFY_TENDERLY } = require('../task-names');

task(TASK_DEPLOY_VERIFY_TENDERLY, 'Verify deployment contracts using Tenderly API')
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .addOptionalParam(
    'contract',
    'Optionally verify only one contract, fully qualified name required.'
  )
  .addFlag('debug', 'Display debug logs', false)
  .addFlag('quiet', 'Silence all output', false)
  .setAction(async ({ instance, contract, quiet, debug }, hre) => {
    logger.quiet = quiet;
    logger.debugging = debug;

    await hre.run(SUBTASK_LOAD_DEPLOYMENT, { readOnly: true, instance });

    const deployment = hre.deployer.deployment.general;

    if (!deployment.properties.completed) {
      throw new HardhatPluginError(
        'Cannot verify contracts from a deployment that is not marked as "complete"',
        Error
      );
    }

    const contractsToVerify = Object.values(deployment.contracts).filter((c) => {
      // Verify Proxy only First deployment
      if (c.isProxy && hre.deployer.previousDeployment) return false;
      // Filter contract by param
      if (contract && c.contractFullyQualifiedName !== contract) return false;
      return true;
    });

    logger.log(`Verifying ${contractsToVerify.length} contracts...`);

    for (const c of contractsToVerify) {
      logger.title(c.contractFullyQualifiedName);

      const params = {
        name: c.contractName,
        address: c.deployedAddress,
      };

      await hre.tenderly.verify(params);
      await hre.tenderly.push(params);
    }
  });
