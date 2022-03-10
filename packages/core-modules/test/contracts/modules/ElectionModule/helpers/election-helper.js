const assert = require('assert/strict');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');

const ElectionPeriod = {
  Idle: 0,
  Nomination: 1,
  Vote: 2,
  Evaluation: 3,
};

const assertDatesAreClose = (dateA, dateB) => {
  const numberDateA = hre.ethers.BigNumber.isBigNumber(dateA) ? dateA.toNumber() : dateA;
  const numberDateB = hre.ethers.BigNumber.isBigNumber(dateB) ? dateB.toNumber() : dateB;

  return Math.abs(numberDateB - numberDateA) <= 1;
};

async function runElection(ElectionModule, members) {
  // Nominate
  await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), hre.ethers.provider);
  for (let member of members) {
    await ElectionModule.connect(member).nominate();
  }

  // Vote
  await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), hre.ethers.provider);
  for (let member of members) {
    await ElectionModule.connect(member).cast([member.address]);
  }

  // Evaluate
  await fastForwardTo(await ElectionModule.getEpochEndDate(), hre.ethers.provider);
  await ElectionModule.evaluate(0);
  assert.equal(await ElectionModule.isElectionEvaluated(), true);
  assert.deepEqual(
    await ElectionModule.getElectionWinners(),
    members.map((w) => w.address)
  );

  // Resolve
  const tx = await ElectionModule.resolve();
  const receipt = await tx.wait();

  return receipt;
}

module.exports = {
  ElectionPeriod,
  assertDatesAreClose,
  runElection,
};
