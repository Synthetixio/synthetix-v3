const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { runElection } = require('./helpers/election-helper');

describe('ElectionModule (resolve)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, ElectionInspectorModule, CouncilToken;

  let owner;
  let member1, member2, member3, member4, member5;

  let members;

  let receipt;

  async function itHasExpectedMembers() {
    it('shows that the members are in the council', async function () {
      assert.deepEqual(
        await ElectionInspectorModule.getCouncilMembers(),
        members.map((m) => m.address)
      );
    });

    it('shows that all members hold their corresponding NFT', async function () {
      for (let member of members) {
        assertBn.equal(await CouncilToken.balanceOf(member.address), 1);

        const tokenId = members.indexOf(member) + 1;
        assert.equal(await CouncilToken.ownerOf(tokenId), member.address);
      }
    });
  }

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [owner, member1, member2, member3, member4, member5] = users;
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );

    ElectionInspectorModule = await ethers.getContractAt(
      'contracts/modules/ElectionInspectorModule.sol:ElectionInspectorModule',
      proxyAddress()
    );
  });

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule.initializeElectionModule(
        'Spartan Council Token',
        'SCT',
        [owner.address],
        1,
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate
      );
    });

    before('identify the council token', async function () {
      const tokenAddress = await ElectionInspectorModule.getCouncilToken();

      CouncilToken = await ethers.getContractAt('CouncilToken', tokenAddress);
    });

    describe('epoch 0', function () {
      before('define members', async function () {
        members = [owner];
      });

      it('shows that the current epoch is 0', async function () {
        assertBn.equal(await ElectionInspectorModule.getEpochIndex(), 0);
      });

      itHasExpectedMembers();

      describe('epoch 1', function () {
        describe('when members 1, 2, and 3 are elected', function () {
          before('define members', async function () {
            members = [member1, member2, member3];
          });

          before('simulate election', async function () {
            receipt = await runElection({
              ElectionModule,
              ElectionInspectorModule,
              owner,
              members,
            });
          });

          it('shows that the current epoch is 1', async function () {
            assertBn.equal(await ElectionInspectorModule.getEpochIndex(), 1);
          });

          itHasExpectedMembers();

          it('emitted an EpochStarted event', async function () {
            const event = findEvent({ receipt, eventName: 'EpochStarted' });

            assert.ok(event);
            assertBn.equal(event.args.epochIndex, 1);
          });

          it('emitted CouncilMemberRemoved events', async function () {
            const event = findEvent({ receipt, eventName: 'CouncilMemberRemoved' });
            assert.ok(event);

            assert.equal(event.args.member, owner.address);
          });

          it('emitted CouncilMemberAdded events', async function () {
            const events = findEvent({ receipt, eventName: 'CouncilMemberAdded' });
            assert.ok(events);

            const addedMembers = events.map((e) => e.args.member);
            assert.equal(addedMembers.length, 3);

            assert.ok(addedMembers.includes(member1.address));
            assert.ok(addedMembers.includes(member2.address));
            assert.ok(addedMembers.includes(member3.address));
          });
        });

        describe('epoch 2', function () {
          describe('when members 2, 3, and 5 are elected', function () {
            before('define members', async function () {
              members = [member2, member3, member5];
            });

            before('simulate election', async function () {
              receipt = await runElection({
                ElectionModule,
                ElectionInspectorModule,
                owner,
                members,
              });
            });

            it('shows that the current epoch is 3', async function () {
              assertBn.equal(await ElectionInspectorModule.getEpochIndex(), 2);
            });

            itHasExpectedMembers();

            it('emitted an EpochStarted event', async function () {
              const event = findEvent({ receipt, eventName: 'EpochStarted' });

              assert.ok(event);
              assertBn.equal(event.args.epochIndex, 2);
            });

            it('emitted CouncilMemberRemoved events', async function () {
              const events = findEvent({ receipt, eventName: 'CouncilMemberRemoved' });
              assert.ok(events);

              const removedMembers = events.map((e) => e.args.member);
              assert.equal(removedMembers.length, 3);

              assert.ok(removedMembers.includes(member1.address));
              assert.ok(removedMembers.includes(member2.address));
              assert.ok(removedMembers.includes(member3.address));
            });

            it('emitted CouncilMemberAdded events', async function () {
              const events = findEvent({ receipt, eventName: 'CouncilMemberAdded' });
              assert.ok(events);

              const addedMembers = events.map((e) => e.args.member);
              assert.equal(addedMembers.length, 3);

              assert.ok(addedMembers.includes(member2.address));
              assert.ok(addedMembers.includes(member3.address));
              assert.ok(addedMembers.includes(member5.address));
            });

            describe('epoch 3', function () {
              describe('when members 3, 4, and 2 are elected', function () {
                before('define members', async function () {
                  members = [member3, member4, member2];
                });

                before('simulate election', async function () {
                  receipt = await runElection({
                    ElectionModule,
                    ElectionInspectorModule,
                    owner,
                    members,
                  });
                });

                it('shows that the current epoch is 4', async function () {
                  assertBn.equal(await ElectionInspectorModule.getEpochIndex(), 3);
                });

                itHasExpectedMembers();

                it('emitted an EpochStarted event', async function () {
                  const event = findEvent({ receipt, eventName: 'EpochStarted' });

                  assert.ok(event);
                  assertBn.equal(event.args.epochIndex, 3);
                });
              });
            });
          });
        });
      });
    });
  });
});
