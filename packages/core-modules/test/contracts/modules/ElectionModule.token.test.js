const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('ElectionModule (token)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, CouncilToken;

  let owner, user;

  const TOKEN_NAME = 'Spartan Council Token';
  const TOKEN_SYMBOL = 'SCT';

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule.initializeElectionModule(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate
      );
    });

    it('shows that the council token was created', async function () {
      assert.notEqual(
        await ElectionModule.getCouncilToken(),
        '0x0000000000000000000000000000000000000000'
      );
    });

    describe('when the council token is identified', function () {
      before('identify token', async function () {
        const tokenAddress = await ElectionModule.getCouncilToken();

        CouncilToken = await ethers.getContractAt('CouncilToken', tokenAddress);
      });

      it('has the correct token name and symbol', async function () {
        assert.equal(await CouncilToken.name(), TOKEN_NAME);
        assert.equal(await CouncilToken.symbol(), TOKEN_SYMBOL);
      });

      it('is owned by the system', async function () {
        assert.equal(await CouncilToken.owner(), proxyAddress());
      });

      it('shows that the owner holds one token', async function () {
        assertBn.eq(await CouncilToken.balanceOf(owner.address), 1);
      });

      it('shows that the first token is held by the owner', async function () {
        assert.equal(await CouncilToken.ownerOf(0), owner.address);
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
            await tx.wait();
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
              CouncilToken.transferFrom(owner.address, user.address, 0),
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
                0
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
                0,
                '0x00'
              ),
              'TokenIsNotTransferable'
            );
          });
        });
      });
    });
  });
});
