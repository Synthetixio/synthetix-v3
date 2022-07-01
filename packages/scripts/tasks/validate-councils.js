const path = require('path');
const assert = require('assert/strict');
const { equal, deepEqual } = require('assert/strict');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const { formatDate, getUnixTimestamp } = require('@synthetixio/core-js/utils/misc/dates');
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

    logger.info(`Validating councils on network "${hre.network.name}"`);

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

        await validateCouncil({ Council, Token, council, epoch });

        await validateCouncilToken({ Token, council, epoch });
      } catch (err) {
        console.error(err);
        logger.error(`Council "${council.name}" is not valid`);
      }
    }
  });

async function validateCouncil({ Council, council, epoch }) {
  logger.info('Council validations:');

  // Validate Initializatiion
  await expect(Council, 'isOwnerModuleInitialized', true);
  await expect(Council, 'isElectionModuleInitialized', true);
  await expect(Council, 'getEpochIndex', epoch);

  // Validate Epoch Properties
  await expect(Council, 'owner', council.owner);
  await expect(Council, 'nominatedOwner', council.nominatedOwner);
  await expect(
    Council,
    'getNominationPeriodStartDate',
    getUnixTimestamp(council.getNominationPeriodStartDate)
  );
  await expect(
    Council,
    'getVotingPeriodStartDate',
    getUnixTimestamp(council.getVotingPeriodStartDate)
  );
  await expect(Council, 'getEpochEndDate', getUnixTimestamp(council.getEpochEndDate));
  await expect(Council, 'getNextEpochSeatCount', council.getNextEpochSeatCount);
  await expect(Council, 'getEpochIndex', council.getEpochIndex);
  await expect(Council, 'getCurrentPeriod', council.getCurrentPeriod);

  if (council.getCouncilMembers) {
    await expect(Council, 'getCouncilMembers', council.getCouncilMembers);
  }
}

async function validateCouncilToken({ Token, council }) {
  logger.info('CouncilToken validations:');

  await expect(Token, 'name', council.councilTokenName);
  await expect(Token, 'symbol', council.councilTokenSymbol);

  // Validate that the council members have 1 CouncilToken
  for (const address of await council.getCouncilMembers) {
    await expect(Token, 'balanceOf', address, 1);
  }
}

function typeOf(val) {
  return Object.prototype.toString.call(val).slice(8, -1);
}

async function expect(Contract, methodName, ...args) {
  const fnParams = args.slice(0, args.length - 1);
  const [expected] = args.slice(-1);
  const result = await Contract[methodName](...fnParams);
  const actual = typeof expected === 'number' ? Number(result) : result;

  const resultIsDate = methodName.includes('Date');

  const paramsStr = fnParams.map(JSON.stringify).join(', ');

  const actualReadable = resultIsDate
    ? formatDate(new Date(actual * 1000))
    : JSON.stringify(actual);
  const resultReadable = resultIsDate
    ? formatDate(new Date(result * 1000))
    : JSON.stringify(result);

  try {
    if (['Array', 'Object'].includes(typeOf(expected))) {
      deepEqual(actual, expected);
    } else {
      equal(actual, expected);
    }

    logger.success(`${methodName}(${paramsStr}) is ${actualReadable}`);
  } catch (_) {
    logger.error(
      `${methodName}(${paramsStr}) expected ${resultReadable}, but got ${actualReadable}`
    );
  }
}
