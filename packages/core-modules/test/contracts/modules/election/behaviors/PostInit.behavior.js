const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { ElectionPeriod, assertDatesAreClose } = require('../helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

module.exports = function (getElectionModule, getInitData) {
  let ElectionModule, CouncilToken;

  let tokenName, tokenSymbol;
  let firstCouncil, member1, member2;
  let minimumActiveMembers;
  let epochStartDate, nominationPeriodStartDate, votingPeriodStartDate, epochEndDate;
  let receipt;

  before('unwrap init data', async function () {
    ({
      tokenName,
      tokenSymbol,
      firstCouncil,
      minimumActiveMembers,
      epochStartDate,
      nominationPeriodStartDate,
      votingPeriodStartDate,
      epochEndDate,
      receipt,
    } = await getInitData());

    [member1, member2] = firstCouncil;
  });

  before('retrieve the election module', async function () {
    ElectionModule = await getElectionModule();
  });

  before('identify the council token', async function () {
    const tokenAddress = await ElectionModule.getCouncilToken();

    CouncilToken = await ethers.getContractAt('CouncilToken', tokenAddress);
  });

  it('produced a token with the correct name and symbol', async function () {
    assert.equal(await CouncilToken.name(), tokenName);
    assert.equal(await CouncilToken.symbol(), tokenSymbol);
  });

  it('emitted an ElectionModuleInitialized event', async function () {
    const event = findEvent({ receipt, eventName: 'ElectionModuleInitialized' });

    assert.ok(event);
  });

  it('emitted an EpochStarted event', async function () {
    const event = findEvent({ receipt, eventName: 'EpochStarted' });

    assert.ok(event);
    assertBn.equal(event.args.epochIndex, 1);
  });

  it('shows that the module is initialized', async () => {
    assert.equal(await ElectionModule.isElectionModuleInitialized(), true);
  });

  it('shows that the current epoch index is 0', async function () {
    assertBn.equal(await ElectionModule.getEpochIndex(), 0);
  });

  it('shows that the current period is Administration', async () => {
    assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('shows that there are two council members', async function () {
    assert.deepEqual(await ElectionModule.getCouncilMembers(), [member1.address, member2.address]);
  });

  it('shows that there are two council NFTs', async function () {
    assertBn.equal(await CouncilToken.balanceOf(member1.address), 1);
    assertBn.equal(await CouncilToken.balanceOf(member2.address), 1);
  });

  it('reflects the expected default settings', async function () {
    assertBn.equal(await ElectionModule.getNextEpochSeatCount(), 2);
    assertBn.equal(await ElectionModule.getMinimumActiveMembers(), 1);
  });

  it('shows that the first epoch has appropriate dates', async function () {
    assertDatesAreClose(await ElectionModule.getEpochStartDate(), epochStartDate);
    assertDatesAreClose(await ElectionModule.getVotingPeriodStartDate(), votingPeriodStartDate);
    assertDatesAreClose(
      await ElectionModule.getNominationPeriodStartDate(),
      nominationPeriodStartDate
    );
    assertDatesAreClose(await ElectionModule.getEpochEndDate(), epochEndDate);
  });

  it('shows that the council token was created', async function () {
    assert.equal(await ElectionModule.getCouncilToken(), CouncilToken.address);
  });

  it('shows that minimumActiveMembers is set', async function () {
    assert.equal(await ElectionModule.getMinimumActiveMembers(), minimumActiveMembers);
  });

  describe('when attemting to re-initialize the module', function () {
    it('reverts', async function () {
      await assertRevert(
        ElectionModule.initializeElectionModule('', '', [], 1, 0, 0, 0),
        'AlreadyInitialized'
      );
    });
  });
};
