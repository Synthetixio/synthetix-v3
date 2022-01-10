const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

const EpochStatus = {
  Idle: 0,
  Nominating: 1,
  Voting: 2,
};

describe.only('ElectionModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe('when initializing the module', function () {
    describe('with an account that does not own the instance', function () {
      before('link to non-owner', async function () {
        ElectionModule = ElectionModule.connect(user);
      });

      it('reverts', async function () {
        await assertRevert(
          ElectionModule.initializeElectionModule(),
          'Unauthorized'
        );
      });
    });

    describe('with the account that owns the instance', function () {
      before('link to owner', async function () {
        ElectionModule = ElectionModule.connect(owner);
      });

      describe('with invalid parameters', function () {
        describe('with an invalid end date', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.initializeElectionModule(),
              'InvalidEpochEndDate'
            );
          });
        });
      });

      describe('with valid parameters', function () {
        before('initialize', async function () {
          await ElectionModule.initializeElectionModule();
        });

        it('shows that the current epoch index is 1', async function () {
          assertBn.eq(
            await ElectionModule.getCurrentEpochIndex(),
            1
          );
        });

        it('shows that the current epoch status is "Idle"', async function () {
          assertBn.eq(
            await ElectionModule.getStatus(),
            EpochStatus.Idle
          );
        });

        describe('when attemting to re-initialize the module', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.initializeElectionModule(),
              'AlreadyInitialized'
            );
          });
        });
      });
    });
  });
});
