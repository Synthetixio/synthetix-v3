const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { runElection } = require('../helpers/election-helper');

module.exports = function (getElectionModule, getInitData) {
  describe('Resolutions', () => {
    let ElectionModule, CouncilToken;

    let member1, member2, member3, member4, member5, member6;

    let firstCouncil, members;

    let receipt;

    let snapshotId;

    before('unwrap init data', async function () {
      ({ firstCouncil } = await getInitData());
    });

    before('take snapshot', async function () {
      snapshotId = await takeSnapshot(ethers.provider);
    });

    after('restore snapshot', async function () {
      await restoreSnapshot(snapshotId, ethers.provider);
    });

    async function itHasExpectedMembers() {
      it('shows that the members are in the council', async function () {
        assert.deepEqual(
          await ElectionModule.getCouncilMembers(),
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

      [member1, member2, member3, member4, member5, member6] = users;
    });

    before('retrieve the election module', async function () {
      ElectionModule = await getElectionModule();
    });

    before('identify the council token', async function () {
      const tokenAddress = await ElectionModule.getCouncilToken();

      CouncilToken = await ethers.getContractAt('CouncilToken', tokenAddress);
    });

    describe('epoch 0', function () {
      before('define members', async function () {
        members = firstCouncil;
      });

      it('shows that the current epoch is 0', async function () {
        assertBn.equal(await ElectionModule.getEpochIndex(), 0);
      });

      itHasExpectedMembers();

      describe('epoch 1', function () {
        describe('when members 2, 3, and 4 are elected', function () {
          before('define members', async function () {
            members = [member2, member3, member4];
          });

          before('simulate election', async function () {
            receipt = await runElection(ElectionModule, member1, members);
          });

          it('shows that the current epoch is 1', async function () {
            assertBn.equal(await ElectionModule.getEpochIndex(), 1);
          });

          itHasExpectedMembers();

          it('emitted an EpochStarted event', async function () {
            const event = findEvent({ receipt, eventName: 'EpochStarted' });

            assert.ok(event);
            assertBn.equal(event.args.epochIndex, 1);
          });

          it('emitted CouncilMemberRemoved events', async function () {
            const events = findEvent({ receipt, eventName: 'CouncilMemberRemoved' });
            assert.ok(events);

            const removedMembers = events.map((e) => e.args.member);
            assert.equal(removedMembers.length, 2);

            assert.ok(removedMembers.includes(member1.address));
            assert.ok(removedMembers.includes(member2.address));
          });

          it('emitted CouncilMemberAdded events', async function () {
            const events = findEvent({ receipt, eventName: 'CouncilMemberAdded' });
            assert.ok(events);

            events.forEach((event) => assertBn.equal(event.args.epochIndex, 1));

            const addedMembers = events.map((e) => e.args.member);
            assert.equal(addedMembers.length, 3);

            assert.ok(addedMembers.includes(member2.address));
            assert.ok(addedMembers.includes(member3.address));
            assert.ok(addedMembers.includes(member4.address));
          });
        });

        describe('epoch 2', function () {
          describe('when members 3, 4, and 6 are elected', function () {
            before('define members', async function () {
              members = [member3, member4, member6];
            });

            before('simulate election', async function () {
              receipt = await runElection(ElectionModule, member1, members);
            });

            it('shows that the current epoch is 3', async function () {
              assertBn.equal(await ElectionModule.getEpochIndex(), 2);
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

              events.forEach((event) => assertBn.equal(event.args.epochIndex, 2));

              const removedMembers = events.map((e) => e.args.member);
              assert.equal(removedMembers.length, 3);

              assert.ok(removedMembers.includes(member2.address));
              assert.ok(removedMembers.includes(member3.address));
              assert.ok(removedMembers.includes(member4.address));
            });

            it('emitted CouncilMemberAdded events', async function () {
              const events = findEvent({ receipt, eventName: 'CouncilMemberAdded' });
              assert.ok(events);

              events.forEach((event) => assertBn.equal(event.args.epochIndex, 2));

              const addedMembers = events.map((e) => e.args.member);
              assert.equal(addedMembers.length, 3);

              assert.ok(addedMembers.includes(member3.address));
              assert.ok(addedMembers.includes(member4.address));
              assert.ok(addedMembers.includes(member6.address));
            });

            describe('epoch 3', function () {
              describe('when members 4, 5, and 3 are elected', function () {
                before('define members', async function () {
                  members = [member4, member5, member3];
                });

                before('simulate election', async function () {
                  receipt = await runElection(ElectionModule, member1, members);
                });

                it('shows that the current epoch is 4', async function () {
                  assertBn.equal(await ElectionModule.getEpochIndex(), 3);
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
};
