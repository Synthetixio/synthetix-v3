const path = require('path');
const assert = require('assert/strict');
const { equal, deepEqual } = require('assert/strict');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const { formatDate } = require('@synthetixio/core-js/utils/misc/dates');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { getDeployment, getDeploymentAbis } = require('@synthetixio/deployer/utils/deployments');
const getPackageProxy = require('../internal/get-package-proxy');

const councils = [
  {
    name: 'ambassador-council',
    owner: '0x6cd3f878852769e04A723A5f66CA7DD4d9E38A6C',
    nominatedOwner: '0x0000000000000000000000000000000000000000',
    members: [
      '0x585639fBf797c1258eBA8875c080Eb63C833d252',
      '0x98Ab20307fdABa1ce8b16d69d22461c6dbe85459',
      '0xF68D2BfCecd7895BBa05a7451Dd09A1749026454',
    ],
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
    councilTokenName: 'Synthetix Ambassador Council Token',
    councilTokenSymbol: 'SNX-ACT',
    nextEpochSeatCount: 3,
    epochIndex: 1,
    currentPeriod: 0,
  },
  {
    name: 'grants-council',
    owner: '0x6cd3f878852769e04A723A5f66CA7DD4d9E38A6C',
    nominatedOwner: '0x0000000000000000000000000000000000000000',
    members: [
      '0xE1f02F7E90ea5F21D0AC6F12c659C3484c143B03',
      '0x1a207bEefC754735871CEEb4C506686F044B1c41',
      '0x4f370B4d03D2b46CcE26F1aEFE142708E03D7FFE',
      '0x8be60fe9F7C8d940D8DA9d5dDD0D8E0c15A4288B',
      '0xbF49B454818783D12Bf4f3375ff17C59015e66Cb',
    ],
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
    councilTokenName: 'Synthetix Grants Council Token',
    councilTokenSymbol: 'SNX-GCT',
    nextEpochSeatCount: 5,
    epochIndex: 1,
    currentPeriod: 0,
  },
  {
    name: 'spartan-council',
    owner: '0x6cd3f878852769e04A723A5f66CA7DD4d9E38A6C',
    nominatedOwner: '0x0000000000000000000000000000000000000000',
    members: [
      '0x45a10F35BeFa4aB841c77860204b133118B7CcAE',
      '0x42f9134E9d3Bf7eEE1f8A5Ac2a4328B059E7468c',
      '0xA9903BDA477b9A57BD795AdFf9922cB98DB65F04',
      '0x0bc3668d2AaFa53eD5E5134bA13ec74ea195D000',
      '0x656b7f17933eE35058d1Beb8b6c65B580E799440',
      '0x1f2B0633BB0623dCCebE57932d6731Ae93f5213E',
      '0xA41228DE09fD143727d6337585C6b02C698146BC',
      '0xDF09B6BB09FdEe5f8d4c17C6642F0A54D6A7654A',
    ],
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
    councilTokenName: 'Synthetix Spartan Council Token',
    councilTokenSymbol: 'SNX-SCT',
    nextEpochSeatCount: 8,
    epochIndex: 1,
    currentPeriod: 0,
  },
  {
    name: 'treasury-council',
    owner: '0x6cd3f878852769e04A723A5f66CA7DD4d9E38A6C',
    nominatedOwner: '0x0000000000000000000000000000000000000000',
    members: [
      '0x604F127145CAC2467389124f0871227D3fD6F628',
      '0xD09583bBf77D0Da34Cd02612Fe41aF4AE37ebC95',
      '0xf04A6E38C6CFE0AcFbeB472888ed990787e69072',
      '0x0e859372c72b01cc86BD4B6dF28Dd57E08226A1a',
    ],
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
    councilTokenName: 'Synthetix Treasury Council Token',
    councilTokenSymbol: 'SNX-TCT',
    nextEpochSeatCount: 4,
    epochIndex: 1,
    currentPeriod: 0,
  },
];

task('validate-councils')
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .setAction(async ({ instance }, hre) => {
    logger.notice(`Validating councils on network "${hre.network.name}"`);

    for (const council of councils) {
      try {
        await validateCouncil({ instance }, council, hre);
      } catch (err) {
        console.error(err);
        logger.error(`Council "${council.name}" is not valid`);
      }
    }
  });

async function validateCouncil({ instance }, council, hre) {
  logger.subtitle(`Validating ${council.name}`);

  const info = {
    network: hre.network.name,
    instance,
    folder: path.join(__dirname, '..', '..', council.name, 'deployments'),
  };

  const deployment = getDeployment(info);
  const abis = getDeploymentAbis(info);

  const Proxy = await getPackageProxy(hre, council.name, instance);

  logger.info(`Proxy Address: ${Proxy.address}`);

  assert(deployment.properties.completed, `Deployment of ${council.name} is not completed`);
  logger.success('Deployment complete');

  await expect({ Contract: Proxy, methodName: 'isOwnerModuleInitialized', expectedValue: true });
  await expect({ Contract: Proxy, methodName: 'owner', expectedValue: council.owner });
  await expect({
    Contract: Proxy,
    methodName: 'nominatedOwner',
    expectedValue: council.nominatedOwner,
  });
  await expect({ Contract: Proxy, methodName: 'isElectionModuleInitialized', expectedValue: true });
  await expect({
    Contract: Proxy,
    methodName: 'getCouncilMembers',
    expectedValue: council.members,
  });
  await expect({
    Contract: Proxy,
    methodName: 'getNextEpochSeatCount',
    expectedValue: council.nextEpochSeatCount,
  });
  await expect({ Contract: Proxy, methodName: 'getEpochIndex', expectedValue: council.epochIndex });
  await expect({
    Contract: Proxy,
    methodName: 'getCurrentPeriod',
    expectedValue: council.currentPeriod,
  });
  await expect({
    Contract: Proxy,
    methodName: 'getNominationPeriodStartDate',
    expectedValue: council.nominationPeriodStartDate,
    isDate: true,
  });
  await expect({
    Contract: Proxy,
    methodName: 'getVotingPeriodStartDate',
    expectedValue: council.votingPeriodStartDate,
    isDate: true,
  });
  await expect({
    Contract: Proxy,
    methodName: 'getEpochEndDate',
    expectedValue: council.epochEndDate,
    isDate: true,
  });

  const councilTokenAddress = await Proxy.getCouncilToken();
  const Token = await hre.ethers.getContractAt(
    abis['@synthetixio/core-modules/contracts/tokens/CouncilToken.sol:CouncilToken'],
    councilTokenAddress
  );

  logger.info(`Token Address: ${councilTokenAddress}`);
  await expect({ Contract: Token, methodName: 'name', expectedValue: council.councilTokenName });
  await expect({
    Contract: Token,
    methodName: 'symbol',
    expectedValue: council.councilTokenSymbol,
  });

  for (const member of council.members) {
    await expect({
      Contract: Token,
      methodName: 'balanceOf',
      expectedValue: 1,
      methodParams: member,
    });
  }
}

function date(dateStr) {
  return new Date(dateStr).valueOf() / 1000;
}

async function expect({
  Contract,
  methodName,
  expectedValue,
  isDate = false,
  methodParams = null,
}) {
  const result = await Contract[methodName](methodParams);
  const actual = typeof expectedValue === 'number' ? Number(result) : result;

  function printValue(value) {
    return `${value}${isDate ? ` (${formatDate(new Date(value * 1000))})` : ''}`;
  }

  function printMethod() {
    return `${methodName}${methodParams !== null ? `(${methodParams})` : ''}`;
  }

  try {
    if (typeof expectedValue === 'object') {
      deepEqual(actual, expectedValue);
    } else {
      equal(actual, expectedValue);
    }

    logger.success(`${printMethod()} is "${printValue(expectedValue)}"`);
  } catch (err) {
    logger.error(
      `Was expecting ${printValue(expectedValue)} for ${printMethod()}, but received ${printValue(
        actual
      )}`
    );
  }
}
