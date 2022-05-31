const path = require('path');
const assert = require('assert/strict');
const { equal } = require('assert/strict');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { SUBTASK_GET_MULTICALL_ABI } = require('@synthetixio/deployer/task-names');
const {
  getDeployment,
  getDeploymentFile,
  getDeploymentExtendedFiles,
} = require('@synthetixio/deployer/utils/deployments');

const councils = [
  {
    name: 'ambassador-council',
    owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
    councilTokenName: 'Synthetix Ambassador Council Token',
    councilTokenSymbol: 'SNX-ACT',
  },
  {
    name: 'grants-council',
    owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
    councilTokenName: 'Synthetix Grants Council Token',
    councilTokenSymbol: 'SNX-GCT',
  },
  {
    name: 'spartan-council',
    owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
    councilTokenName: 'Synthetix Spartan Council Token',
    councilTokenSymbol: 'SNX-SCT',
  },
  {
    name: 'treasury-council',
    owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
    councilTokenName: 'Synthetix Treasury Council Token',
    councilTokenSymbol: 'SNX-TCT',
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
  const deploymentFile = getDeploymentFile(info);
  const deploymentExtendedFiles = getDeploymentExtendedFiles(deploymentFile);

  const abis = require(deploymentExtendedFiles.abis);
  const { deployedAddress } = Object.values(deployment.contracts).find((c) => c.isProxy);

  logger.info(`Proxy Address: ${deployedAddress}`);

  const abi = await hre.run(SUBTASK_GET_MULTICALL_ABI, { info });
  const Proxy = await hre.ethers.getContractAt(abi, deployedAddress);

  assert(deployment.properties.completed, `Deployment of ${council.name} is not completed`);
  logger.success('Deployment complete');

  await expect(Proxy, 'isOwnerModuleInitialized', true);
  await expect(Proxy, 'owner', council.owner);

  await expect(Proxy, 'isElectionModuleInitialized', true);
  await expect(Proxy, 'isElectionModuleInitialized', true);
  await expect(Proxy, 'getNominationPeriodStartDate', council.nominationPeriodStartDate);
  await expect(Proxy, 'getVotingPeriodStartDate', council.votingPeriodStartDate);
  await expect(Proxy, 'getEpochEndDate', council.epochEndDate);

  const councilTokenAddress = await Proxy.getCouncilToken();
  const Token = await hre.ethers.getContractAt(
    abis['@synthetixio/core-modules/contracts/tokens/CouncilToken.sol:CouncilToken'],
    councilTokenAddress
  );

  logger.info(`Token Address: ${councilTokenAddress}`);
  await expect(Token, 'name', council.councilTokenName);
  await expect(Token, 'symbol', council.councilTokenSymbol);
}

function date(dateStr) {
  return new Date(dateStr).valueOf() / 1000;
}

async function expect(Contract, methodName, expected) {
  const result = await Contract[methodName]();
  const actual = typeof expected === 'number' ? Number(result) : result;
  equal(actual, expected);
  logger.success(`${methodName} is "${expected}"`);
}
