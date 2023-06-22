const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const { daysToSeconds } = require('@synthetixio/core-utils/utils/misc/dates');
const { getTime } = require('@synthetixio/core-utils/utils/hardhat/rpc');
const { bootstrap } = require('@synthetixio/router/dist/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('SynthetixElectionModule (initialization)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, DebtShare;

  let owner, user;

  let epochStartDate, epochEndDate, nominationPeriodStartDate, votingPeriodStartDate;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );
  });

  describe('before initializing the module', function () {
    it('shows that the module is not initialized', async () => {
      assert.equal(await ElectionModule.isElectionModuleInitialized(), false);
    });
  });

  before('deploy debt shares mock', async function () {
    const factory = await ethers.getContractFactory('DebtShareMock');
    DebtShare = await factory.deploy();
  });

  describe('when initializing the module', function () {
    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user)[
            'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64,address)'
          ]('', '', [], 0, 0, 0, 0, DebtShare.address),
          'Unauthorized'
        );
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with the wrong initializer', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.connect(owner)[
              'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64)'
            ]('', '', [owner.address], 1, 0, 0, 0),
            'WrongInitializer'
          );
        });
      });

      describe('with invalid parameters', function () {
        describe('with invalid debtShareContract', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.connect(owner)[
                'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64,address)'
              ]('', '', [owner.address], 1, 0, 0, 0, '0x0000000000000000000000000000000000000000'),
              'ZeroAddress'
            );
            await assertRevert(
              ElectionModule.connect(owner)[
                'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64,address)'
              ]('', '', [owner.address], 1, 0, 0, 0, user.address),
              'NotAContract'
            );
          });
        });
      });

      describe('with valid parameters', function () {
        before('initialize', async function () {
          epochStartDate = await getTime(ethers.provider);
          epochEndDate = epochStartDate + daysToSeconds(90);
          votingPeriodStartDate = epochEndDate - daysToSeconds(7);
          nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

          const tx = await ElectionModule[
            'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64,address)'
          ](
            'Spartan Council Token',
            'SCT',
            [owner.address, user.address],
            1,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate,
            DebtShare.address
          );

          await tx.wait();
        });

        it('set the debt share contract address', async function () {
          assert.equal(await ElectionModule.getDebtShareContract(), DebtShare.address);
        });
      });
    });
  });
});
