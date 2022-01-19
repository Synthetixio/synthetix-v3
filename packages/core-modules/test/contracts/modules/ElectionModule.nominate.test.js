const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { ElectionPeriod } = require('../../helpers/election-helper');

describe('ElectionModule (nominate)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let user, users;

  let nominees = [];

  async function nominate(signer) {
    nominees.push(signer.address);

    await ElectionModule.connect(signer).nominate();
  }

  async function withdrawNomination(signer) {
    const index = nominees.indexOf(signer.address);

    if (index !== nominees.length - 1) {
      const lastValue = nominees[nominees.length - 1];

      nominees[index] = lastValue;
    }

    nominees.pop();

    await ElectionModule.connect(signer).withdrawNomination();
  }

  const itProperlyRecordsNominees = () => {
    it('records nominated and non-nominated users', async function () {
      for (let user of users) {
        assert.equal(
          await ElectionModule.isNominated(user.address),
          nominees.includes(user.address)
        );
      }
    });

    it('tracks the nominee array', async function () {
      assert.deepEqual(await ElectionModule.getNominees(), nominees);
    });
  };

  before('identify signers', async () => {
    users = await ethers.getSigners();

    [user] = users;
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      await ElectionModule.initializeElectionModule(
        daysToSeconds(90),
        daysToSeconds(7),
        daysToSeconds(7)
      );
    });

    describe('when entering the nomination period', function () {
      before('fast forward', async function () {
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Nomination);
      });

      describe('before users nominate', function () {
        itProperlyRecordsNominees();
      });

      describe('when a user self nominates', function () {
        before('nominate', async function () {
          await nominate(user);
        });

        itProperlyRecordsNominees();

        describe('when a user that is not nominated attempts to withdraw', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.connect(users[2]).withdrawNomination(),
              'NotNominated'
            );
          });
        });

        describe('when more users nominate', function () {
          before('nominate', async function () {
            await nominate(users[2]);
            await nominate(users[3]);
            await nominate(users[4]);
          });

          itProperlyRecordsNominees();

          describe('when a user attempts to nominate again', function () {
            it('reverts', async function () {
              await assertRevert(ElectionModule.connect(user).nominate(), 'AlreadyNominated');
            });
          });

          describe('when a user withdraws its nomination', function () {
            before('withdraw', async function () {
              await withdrawNomination(user);
            });

            itProperlyRecordsNominees();

            describe('when more users nominate', function () {
              before('nominate', async function () {
                await nominate(users[5]);
                await nominate(users[7]);
                await nominate(users[10]);
                await nominate(users[12]);
                await nominate(users[16]);
              });

              itProperlyRecordsNominees();

              describe('when more users withdraw nominations', function () {
                before('withdraw', async function () {
                  await withdrawNomination(users[7]);
                  await withdrawNomination(users[12]);
                });

                itProperlyRecordsNominees();
              });
            });
          });
        });
      });
    });
  });
});
