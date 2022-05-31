const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { equal } = require('assert/strict');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
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
  const abis = JSON.parse(fs.readFileSync(deploymentExtendedFiles.abis));

  /*
   * General Checks
   */
  assert(deployment.properties.completed, `Deployment of ${council.name} is not completed`);

  const proxy = Object.values(deployment.contracts).find((c) => c.isProxy);

  /*
   * Ownership
   */
  const OwnerModule = await hre.ethers.getContractAt(
    abis['contracts/modules/OwnerModule.sol:OwnerModule'],
    proxy.deployedAddress
  );

  assert(await OwnerModule.isOwnerModuleInitialized());
  equal(await OwnerModule.owner(), council.owner, 'Owner is invalid');

  /*
   * ElectionModule
   */
  const ElectionModule = await hre.ethers.getContractAt(
    abis['contracts/modules/ElectionModule.sol:ElectionModule'],
    proxy.deployedAddress
  );

  assert(await ElectionModule.isElectionModuleInitialized());
  assert(
    Number(await ElectionModule.getNominationPeriodStartDate()),
    council.nominationPeriodStartDate
  );
  assert(Number(await ElectionModule.getVotingPeriodStartDate()), council.votingPeriodStartDate);
  assert(Number(await ElectionModule.getEpochEndDate()), council.epochEndDate);

  logger.success('All checks passed');
}

function date(dateStr) {
  return new Date(dateStr).valueOf() / 1000;
}
