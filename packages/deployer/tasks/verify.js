const { task } = require('hardhat/config');
const { HardhatPluginError } = require('hardhat/plugins');
const { TASK_VERIFY_VERIFY } = require('@nomiclabs/hardhat-etherscan/dist/src/constants');
const { default: logger } = require('@synthetixio/core-js/utils/io/logger')
const types = require('@synthetixio/core-js/utils/hardhat/argument-types')
const {
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_LOAD_DEPLOYMENT,
  TASK_DEPLOY_VERIFY,
} = require('../task-names');

task(TASK_DEPLOY_VERIFY, 'Verify deployment contracts using Etherscan API')
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

    const contracts = Object.values(deployment.contracts);

    const contractsToVerify = contract
      ? contracts.filter((c) => c.contractFullyQualifiedName === contract)
      : contracts;

    // Verify Contracts
    for (const c of contractsToVerify) {
      const { deployedAddress, contractFullyQualifiedName, isProxy, isRouter } = c;

      const constructorArguments = [];

      if (isRouter) {
        // Make sure the Router is generated correctly
        await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE);
      }

      if (isProxy) {
        // Verify Proxy only First deployment
        if (hre.deployer.previousDeployment) continue;
        // Add Router address for Proxy constructor
        const Router = contracts.find((c) => c.isRouter);
        constructorArguments.push(Router.deployedAddress);
      }

      logger.title(`Verifying ${contractFullyQualifiedName}...`);

      try {
        await hre.run(TASK_VERIFY_VERIFY, {
          address: deployedAddress,
          contract: contractFullyQualifiedName,
          constructorArguments,
        });
      } catch (err) {
        if (
          err.message === 'Contract source code already verified' ||
          err.message.endsWith('Reason: Already Verified')
        ) {
          logger.info('Contract source code already verified');
        } else {
          throw err;
        }
      }

      logger.log('');
    }
  });
