const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

module.exports = function (getElectionModule, getInitData, proxyAddress) {
  describe('Council token', () => {
    let ElectionModule, CouncilToken;

    let owner, user;

    let tokenName, tokenSymbol;

    let receipt;

    let snapshotId;

    before('unwrap init data', async function () {
      ({ tokenName, tokenSymbol, receipt } = await getInitData());
    });

    before('take snapshot', async function () {
      snapshotId = await takeSnapshot(ethers.provider);
    });

    after('restore snapshot', async function () {
      await restoreSnapshot(snapshotId, ethers.provider);
    });

    before('identify signers', async () => {
      [owner, user] = await ethers.getSigners();
    });

    before('retrieve the election module', async function () {
      ElectionModule = await getElectionModule();
    });

    describe('when the council token is identified', function () {
      before('identify token', async function () {
        const tokenAddress = await ElectionModule.getCouncilToken();

        CouncilToken = await ethers.getContractAt('CouncilToken', tokenAddress);
      });

      it('shows that the council token was created', async function () {
        assert.equal(await ElectionModule.getCouncilToken(), CouncilToken.address);
      });

      it('emitted an CouncilTokenCreated event', async function () {
        const event = findEvent({ receipt, eventName: 'CouncilTokenCreated' });

        assert.ok(event);
        assert.equal(event.args.proxy, CouncilToken.address);
        assert.equal(event.args.implementation, await CouncilToken.getImplementation());
      });

      it('has the correct token name and symbol', async function () {
        assert.equal(await CouncilToken.name(), tokenName);
        assert.equal(await CouncilToken.symbol(), tokenSymbol);
      });

      it('is owned by the system', async function () {
        assert.equal(await CouncilToken.owner(), proxyAddress());
      });

      it('shows that the owner holds one token', async function () {
        assertBn.equal(await CouncilToken.balanceOf(owner.address), 1);
      });

      it('shows that the first token is held by the owner', async function () {
        assert.equal(await CouncilToken.ownerOf(1), owner.address);
      });

      describe('when upgrading the council token', function () {
        describe('using an account that is not the owner', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.connect(user).upgradeCouncilToken(user.address),
              'Unauthorized'
            );
          });
        });

        describe('with the owner account', function () {
          let NewCouncilTokenImplementation;

          before('upgrade', async function () {
            const factory = await ethers.getContractFactory('CouncilToken');
            NewCouncilTokenImplementation = await factory.deploy();

            const tx = await ElectionModule.upgradeCouncilToken(
              NewCouncilTokenImplementation.address
            );
            receipt = await tx.wait();
          });

          it('emitted an CouncilTokenUpgraded event', async function () {
            const event = findEvent({ receipt, eventName: 'CouncilTokenUpgraded' });

            assert.ok(event);
            assert.equal(event.args.newImplementation, NewCouncilTokenImplementation.address);
          });

          it('shows that the implementation was upgraded', async function () {
            assert.equal(
              await CouncilToken.getImplementation(),
              NewCouncilTokenImplementation.address
            );
          });
        });
      });

      describe('when attempting to transfer the council token', function () {
        describe('using transferFrom', function () {
          it('reverts', async function () {
            await assertRevert(
              CouncilToken.transferFrom(owner.address, user.address, 1),
              'TokenIsNotTransferable'
            );
          });
        });

        describe('using safeTransferFrom without data', function () {
          it('reverts', async function () {
            await assertRevert(
              CouncilToken['safeTransferFrom(address,address,uint256)'](
                owner.address,
                user.address,
                1
              ),
              'TokenIsNotTransferable'
            );
          });
        });

        describe('using safeTransferFrom with data', function () {
          it('reverts', async function () {
            await assertRevert(
              CouncilToken['safeTransferFrom(address,address,uint256,bytes)'](
                owner.address,
                user.address,
                1,
                '0x00'
              ),
              'TokenIsNotTransferable'
            );
          });
        });
      });
    });
  });
};
