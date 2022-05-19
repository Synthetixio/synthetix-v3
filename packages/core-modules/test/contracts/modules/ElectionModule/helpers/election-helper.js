const { ethers } = hre;
const assert = require('assert/strict');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');

const ElectionPeriod = {
  Administration: 0,
  Nomination: 1,
  Vote: 2,
  Evaluation: 3,
};

let ElectionModule;

async function runElection(ElectionModule, owner, members) {
  // Configure
  if ((await ElectionModule.getNextEpochSeatCount()) !== members.length) {
    await ElectionModule.connect(owner).setNextEpochSeatCount(members.length);
  }

  // Nominate
  if ((await ElectionModule.getCurrentPeriod()).toNumber() === ElectionPeriod.Administration) {
    await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), hre.ethers.provider);
  }
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

const assertDatesAreClose = (dateA, dateB) => {
  const numberDateA = hre.ethers.BigNumber.isBigNumber(dateA) ? dateA.toNumber() : dateA;
  const numberDateB = hre.ethers.BigNumber.isBigNumber(dateB) ? dateB.toNumber() : dateB;

  return Math.abs(numberDateB - numberDateA) <= 1;
};

module.exports = {
  ElectionPeriod,
  assertDatesAreClose,
  runElection,
};
