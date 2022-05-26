const { task } = require('hardhat/config');
const { HardhatPluginError } = require('hardhat/plugins');

const {
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_LOAD_DEPLOYMENT,
  TASK_DEPLOY_VERIFY,
} = require('../task-names');

const logger = require('@synthetixio/core-js/utils/io/logger');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');

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
  .setAction(async ({ instance, contract }, hre) => {
    await hre.run(SUBTASK_LOAD_DEPLOYMENT, { readOnly: true, instance });

    const deployment = hre.deployer.deployment.general;

    if (!deployment.properties.completed) {
      throw new HardhatPluginError(
        'Cannot verify contracts from a deployment that is not marked as "complete"',
        Error
      );
    }

    const contracts = Object.values(deployment.contracts);

    const contractsToVerify = contracts.filter((c) => {
      if (!contract) return true;
      return c.contractFullyQualifiedName === contract;
    });

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

      logger.title(contractFullyQualifiedName);

      try {
        await hre.run('verify:verify', {
          address: deployedAddress,
          contract: contractFullyQualifiedName,
          constructorArguments,
        });
      } catch (err) {
        if (err.message === 'Contract source code already verified') {
          logger.info('Contract source code already verified');
        } else {
          throw err;
        }
      }

      console.log();
    }
  });
