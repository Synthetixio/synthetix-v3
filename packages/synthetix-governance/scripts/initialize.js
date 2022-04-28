const hre = require('hardhat');

exports.initialize = async function initialize(jsonArgs) {
  const args = JSON.parse(jsonArgs);

  await exports.initializeOwnerModule(args);
  await exports.initializeElectionModule(args);
};

exports.initializeOwnerModule = async function initializeOwnerModule({
  proxyAddress,
  ownerAddress,
}) {
  const OwnerModule = await hre.ethers.getContractAt(
    'contracts/modules/OwnerModule.sol:OwnerModule',
    proxyAddress
  );

  const tx = await OwnerModule.initializeOwnerModule(ownerAddress);
  await tx.wait();
};

exports.initializeElectionModule = async function initializeElectionModule({
  proxyAddress,
  councilTokenName,
  councilTokenSymbol,
  firstCouncilMembers,
  nominationPeriodStartDate,
  votingPeriodStartDate,
  epochEndDate,
  debtShareAddress,
}) {
  const ElectionModule = await hre.ethers.getContractAt(
    'contracts/modules/ElectionModule.sol:ElectionModule',
    proxyAddress
  );

  const tx = await ElectionModule.initializeElectionModule(
    councilTokenName,
    councilTokenSymbol,
    firstCouncilMembers,
    firstCouncilMembers.length,
    nominationPeriodStartDate,
    votingPeriodStartDate,
    epochEndDate,
    debtShareAddress
  );

  await tx.wait();
};
