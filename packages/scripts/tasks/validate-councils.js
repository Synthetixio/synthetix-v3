const path = require('path');
const assert = require('assert/strict');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const {
  fromUnixTimestamp,
  toUnixTimestamp,
} = require('@synthetixio/core-js/utils/misc/dates');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { getDeployment, getDeploymentAbis } = require('@synthetixio/deployer/utils/deployments');
const getPackageProxy = require('../internal/get-package-proxy');
const importJson = require('../internal/import-json');

task('validate-councils')
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .addParam('epoch', 'Epoch index to validate', undefined, types.int)
  .setAction(async ({ instance, epoch }, hre) => {
    epoch = Number(epoch);

    logger.info(`Validating councils on network "${hre.network.name}" (${hre.network.config.url})`);

    const councils = await importJson(`${__dirname}/../data/councils-epoch-${epoch}.json`);

    for (const council of councils) {
      logger.subtitle(`Validating ${council.name}`);

      try {
        const info = {
          network: hre.network.name,
          instance,
          folder: path.join(__dirname, '..', '..', council.name, 'deployments'),
        };

        // Retrieve Council contract
        const Council = await getPackageProxy(hre, council.name, instance);
        logger.info(`Council Address: ${Council.address}`);

        // Retrieve Token contract
        const councilTokenAddress = await Council.getCouncilToken();
        const abis = getDeploymentAbis(info);
        const Token = await hre.ethers.getContractAt(
          abis['@synthetixio/core-modules/contracts/tokens/CouncilToken.sol:CouncilToken'],
          councilTokenAddress
        );
        logger.info(`Token Address: ${Token.address}`);

        // Check Deployment Status
        const deployment = getDeployment(info);
        assert(deployment.properties.completed, `Deployment of ${council.name} is not completed`);
        logger.success('Deployment complete');

        await validateCouncil({ Council, council });

        await validateCouncilToken({ Token, council });
      } catch (err) {
        console.error(err);
        logger.error(`Council "${council.name}" is not valid`);
      }
    }
  });

async function validateCouncil({ Council, council }) {
  logger.info('Council validations:');

  await validate({
    action: Council.isOwnerModuleInitialized(),
    expectedResult: true,
    validation: (result, expectedResult) => result === expectedResult,
    successFn: (result) => logger.success(`OwnerModule is initialized: ${result}`),
    errorFn: (result, expected) =>
      logger.error(
        `Was expecting OwnerModule.isOwnerModuleInitialized to be ${expected}, but received ${result}`
      ),
  });

  await validate({
    action: Council.isElectionModuleInitialized(),
    expectedResult: true,
    validation: (result, expectedResult) => result === expectedResult,
    successFn: (result) => logger.success(`ElectionModule is initialized: ${result}`),
    errorFn: (result, expected) =>
      logger.error(
        `Was expecting ElectionModule.isElectionModuleInitialized to be ${expected}, but received ${result}`
      ),
  });

  await validate({
    action: Council.getMinimumActiveMembers(),
    expectedResult: council.minimumActiveMembers,
    validation: (result, expectedResult) => result.toString() === expectedResult,
    successFn: (result) => logger.success(`Minimum active members is: ${result}`),
    errorFn: (result, expected) =>
      logger.error(
        `Was expecting minimum active members to be ${expected}, but received ${result}`
      ),
  });

  await validate({
    action: Council.getEpochIndex(),
    expectedResult: council.epochIndex,
    validation: (result, expectedResult) => result.toString() === expectedResult,
    successFn: (result) => logger.success(`Epoch index is: ${result}`),
    errorFn: (result, expected) =>
      logger.error(`Was expecting epoch index to be ${expected}, but received ${result}`),
  });

  await validate({
    action: Council.getCurrentPeriod(),
    expectedResult: council.currentPeriod,
    validation: (result, expectedResult) => result.toString() === expectedResult,
    successFn: (result) => logger.success(`Current period is: ${result}`),
    errorFn: (result, expected) =>
      logger.error(`Was expecting current period to be ${expected}, but received ${result}`),
  });

  await validate({
    action: Council.owner(),
    expectedResult: council.owner,
    validation: (result, expectedResult) => result === expectedResult,
    successFn: (result) => logger.success(`Owner is: ${result}`),
    errorFn: (result, expected) =>
      logger.error(`Was expecting owner to be ${expected}, but received ${result}`),
  });

  await validate({
    action: Council.nominatedOwner(),
    expectedResult: council.nominatedOwner,
    validation: (result, expectedResult) => result === expectedResult,
    successFn: (result) => logger.success(`Nominated owner is: ${result}`),
    errorFn: (result, expected) =>
      logger.error(`Was expecting nominated owner to be ${expected}, but received ${result}`),
  });

  await validate({
    action: Council.getNextEpochSeatCount(),
    expectedResult: council.nextEpochSeatCount,
    validation: (result, expectedResult) => result.toString() === expectedResult,
    successFn: (result) => logger.success(`Next epoch seat count is: ${result}`),
    errorFn: (result, expected) =>
      logger.error(`Was expecting next epoch seat count to be ${expected}, but received ${result}`),
  });

  await validate({
    action: Council.getCouncilMembers(),
    expectedResult: council.councilMembers.join(','),
    validation: (result, expectedResult) => result.toString() === expectedResult,
    successFn: (result) => logger.success(`Council members are: ${result}`),
    errorFn: (result, expected) =>
      logger.error(`Was expecting council members to be ${expected}, but received ${result}`),
  });

  await validate({
    action: Council.getNominationPeriodStartDate(),
    expectedResult: council.nominationPeriodStartDate,
    validation: (result, expectedResult) => readableDate(result) === expectedResult,
    successFn: (result) =>
      logger.success(`Nomination period start date is: ${readableDate(result)} - (${result})`),
    errorFn: (result, expected) =>
      logger.error(
        `Was expecting nomination period start date to be ${expected} - (${toUnixTimestamp(
          new Date(expected)
        )}), but received ${readableDate(result)} - (${result})`
      ),
  });

  await validate({
    action: Council.getVotingPeriodStartDate(),
    expectedResult: council.votingPeriodStartDate,
    validation: (result, expectedResult) => readableDate(result) === expectedResult,
    successFn: (result) =>
      logger.success(`Voting period start date is: ${readableDate(result)} - (${result})`),
    errorFn: (result, expected) =>
      logger.error(
        `Was expecting voting period start date to be ${expected} - (${toUnixTimestamp(
          new Date(expected)
        )}), but received ${readableDate(result)} - (${result})`
      ),
  });

  await validate({
    action: Council.getEpochEndDate(),
    expectedResult: council.epochEndDate,
    validation: (result, expectedResult) => readableDate(result) === expectedResult,
    successFn: (result) =>
      logger.success(`Epoch end date is: ${readableDate(result)} - (${result})`),
    errorFn: (result, expected) =>
      logger.error(
        `Was expecting epoch end date to be ${expected} - (${toUnixTimestamp(
          new Date(expected)
        )}), but received ${readableDate(result)} - (${result})`
      ),
  });
}

async function validateCouncilToken({ Token, council }) {
  logger.info('CouncilToken validations:');

  await validate({
    action: Token.name(),
    expectedResult: council.councilTokenName,
    validation: (result, expectedResult) => result === expectedResult,
    successFn: (result) => logger.success(`Council token name is: ${result}`),
    errorFn: (result, expected) =>
      logger.error(`Was expecting council token name to be ${expected}, but received ${result}`),
  });

  await validate({
    action: Token.symbol(),
    expectedResult: council.councilTokenSymbol,
    validation: (result, expectedResult) => result === expectedResult,
    successFn: (result) => logger.success(`Council token symbol is: ${result}`),
    errorFn: (result, expected) =>
      logger.error(`Was expecting council token symbol to be ${expected}, but received ${result}`),
  });

  for (const address of await council.councilMembers) {
    await validate({
      action: Token.balanceOf(address),
      expectedResult: '1',
      validation: (result, expectedResult) => result.toString() === expectedResult,
      successFn: (result) => logger.success(`Token balance of ${address}: ${result}`),
      errorFn: (result, expected) =>
        logger.error(
          `Was expecting token balance of ${address} to be ${expected}, but received ${result.toString()}`
        ),
    });
  }
}

function readableDate(timestamp) {
  return fromUnixTimestamp(timestamp).toISOString();
}

async function validate({ action, expectedResult, validation, successFn, errorFn }) {
  const result = await action;

  if (validation(result, expectedResult)) {
    successFn(result);
  } else {
    errorFn(result, expectedResult);
  }
}
