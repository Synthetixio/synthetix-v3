const path = require('path');
const assert = require('assert/strict');
const { equal, deepEqual } = require('assert/strict');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
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
    logger.notice(`Validating councils on network "${hre.network.name}"`);

    const councils = await importJson(`${__dirname}/../data/councils-epoch-${epoch}.json`);

    for (const council of councils) {
      logger.subtitle(`Validating ${council.name}`);

      try {
        const info = {
          network: hre.network.name,
          instance,
          folder: path.join(__dirname, '..', '..', council.name, 'deployments'),
        };

        // Initialize Proxy
        const Proxy = await getPackageProxy(hre, council.name, instance);
        logger.info(`Proxy Address: ${Proxy.address}`);

        // Initialize Token
        const councilTokenAddress = await Proxy.getCouncilToken();
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

        await validateCouncil({ Proxy, Token, council });
      } catch (err) {
        console.error(err);
        logger.error(`Council "${council.name}" is not valid`);
      }
    }
  });

async function validateCouncil({ Proxy, Token, council }) {
  // Validate Initializatiion
  await expect(Proxy, 'isOwnerModuleInitialized', true);
  await expect(Proxy, 'isElectionModuleInitialized', true);

  // Validate Epoch Properties
  await expect(Proxy, 'owner', council.owner);
  await expect(Proxy, 'nominatedOwner', council.nominatedOwner);
  await expect(Proxy, 'getNominationPeriodStartDate', date(council.getNominationPeriodStartDate));
  await expect(Proxy, 'getVotingPeriodStartDate', date(council.getVotingPeriodStartDate));
  await expect(Proxy, 'getEpochEndDate', date(council.getEpochEndDate));
  await expect(Proxy, 'getNextEpochSeatCount', council.getNextEpochSeatCount);
  await expect(Proxy, 'getCouncilMembers', council.getCouncilMembers);

  // Validate Council Token
  await expect(Token, 'name', council.councilTokenName);
  await expect(Token, 'symbol', council.councilTokenSymbol);
}

function date(dateStr) {
  return new Date(dateStr).valueOf() / 1000;
}

function typeOf(val) {
  return Object.prototype.toString.call(val).slice(8, -1);
}

async function expect(Contract, methodName, expected) {
  const result = await Contract[methodName]();
  const actual = typeof expected === 'number' ? Number(result) : result;

  try {
    if (['Array', 'Object'].includes(typeOf(expected))) {
      deepEqual(actual, expected);
    } else {
      equal(actual, expected);
    }

    logger.success(`${methodName} is ${JSON.stringify(expected)}`);
  } catch (err) {
    logger.error(`Expected ${expected} for ${methodName}, but given ${actual}\n${err}`);
  }
}
