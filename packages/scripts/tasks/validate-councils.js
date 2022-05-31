const path = require('path');
const assert = require('assert/strict');
const { equal } = require('assert/strict');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { SUBTASK_GET_MULTICALL_ABI } = require('@synthetixio/deployer/task-names');
const { getDeployment } = require('@synthetixio/deployer/utils/deployments');

const councils = [
  {
    name: 'ambassador-council',
    owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
  },
  {
    name: 'grants-council',
    owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
  },
  {
    name: 'spartan-council',
    owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
  },
  {
    name: 'treasury-council',
    owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
    nominationPeriodStartDate: date('2022-06-10'),
    votingPeriodStartDate: date('2022-06-17'),
    epochEndDate: date('2022-07-01'),
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
        await new Promise((resolve) => setTimeout(resolve, 1500));
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
  const { deployedAddress } = Object.values(deployment.contracts).find((c) => c.isProxy);

  logger.info(`Proxy Address: ${deployedAddress}`);

  const abi = await hre.run(SUBTASK_GET_MULTICALL_ABI, { info });
  const Proxy = await hre.ethers.getContractAt(abi, deployedAddress);

  assert(deployment.properties.completed, `Deployment of ${council.name} is not completed`);
  logger.success('Deployment complete');

  assert(await Proxy.isOwnerModuleInitialized());
  equal(await Proxy.owner(), council.owner, 'Owner is invalid');
  logger.success('OwnerModule correctly initialized');

  assert(await Proxy.isElectionModuleInitialized());
  assert(Number(await Proxy.getNominationPeriodStartDate()), council.nominationPeriodStartDate);
  assert(Number(await Proxy.getVotingPeriodStartDate()), council.votingPeriodStartDate);
  assert(Number(await Proxy.getEpochEndDate()), council.epochEndDate);
  logger.success('ElectionModule correctly initialized');
}

function date(dateStr) {
  return new Date(dateStr).valueOf() / 1000;
}
