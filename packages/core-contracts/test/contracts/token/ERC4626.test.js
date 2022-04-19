const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { constants } = require('ethers');

describe('ERC4626', () => {
  let ERC4626, AssetToken;

  let user1, user2;

  before('identify signers', async () => {
    [user1, user2] = await ethers.getSigners();
  });

  before('deploy the contracts', async () => {
    let factory = await ethers.getContractFactory('ERC20Mock');
    AssetToken = await factory.deploy();
    let tx = await AssetToken.initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();

    factory = await ethers.getContractFactory('ERC4626Mock');
    ERC4626 = await factory.deploy();
    tx = await ERC4626.initialize(AssetToken.address, 'SNX Vault', 'vsnx');
    await tx.wait();
  });

  describe('When attempting to initialize it again', () => {
    it('reverts', async () => {
      await assertRevert(
        ERC4626.initialize(AssetToken.address, 'SNX Vault 2', 'vsnx'),
        'AlreadyInitialized()'
      );
    });
  });

  describe('Before doing anything', () => {
    it('the total supply is 0 for both contracts', async () => {
      assertBn.equal(await ERC4626.totalSupply(), 0);
      assertBn.equal(await ERC4626.totalAssets(), 0);
    });

    it('the constructor arguments are set correctly', async () => {
      assert.equal(await ERC4626.name(), 'SNX Vault');
      assert.equal(await ERC4626.symbol(), 'vsnx');
      assert.equal(await ERC4626.asset(), AssetToken.address);
    });

    it('maxs are correctly set', async () => {
      assertBn.equal(await ERC4626.maxDeposit(user1.address), constants.MaxUint256);
      assertBn.equal(await ERC4626.maxMint(user1.address), constants.MaxUint256);
      assertBn.equal(await ERC4626.maxWithdraw(user1.address), constants.MaxUint256);
      assertBn.equal(await ERC4626.maxRedeem(user1.address), constants.MaxUint256);
    });

    it('preview the right values', async () => {
      // 0 since no assets
      assertBn.equal(await ERC4626.convertToAssets(constants.WeiPerEther), 0);

      // 1 : 1 (no previous shares)
      assertBn.equal(await ERC4626.convertToShares(constants.WeiPerEther), constants.WeiPerEther);

      // 1 : 1 (no previous shares)
      assertBn.equal(await ERC4626.previewDeposit(constants.One), 1);
      assertBn.equal(await ERC4626.previewMint(constants.One), 1);

      // 0 since no assets
      assertBn.equal(await ERC4626.previewRedeem(constants.One), 0);
      assertBn.equal(await ERC4626.previewWithdraw(constants.One), 0);
    });
  });

  describe('Single Deposit and Withdraw', () => {
    const user1Assets = ethers.BigNumber.from('1000000');
    let receipt;

    before('mint', async () => {
      const tx = await AssetToken.connect(user1).mint(user1Assets);
      receipt = await tx.wait();
    });

    after('burn', async () => {
      const tx = await AssetToken.connect(user1).burn(user1Assets);
      receipt = await tx.wait();
    });

    before('approves vault to use user1 assets', async () => {
      const tx = await AssetToken.connect(user1).approve(ERC4626.address, user1Assets);
      receipt = await tx.wait();
    });

    it('vault is approved to use user1 assets', async () => {
      assertBn.equal(await AssetToken.allowance(user1.address, ERC4626.address), user1Assets);
    });

    describe('when user deposits some assets', async () => {
      let receipt, user1Shares;
      before('do the deposit', async () => {
        const tx = await ERC4626.connect(user1).deposit(user1Assets, user1.address);
        receipt = await tx.wait();
      });

      before('get user1 shares', async () => {
        user1Shares = await ERC4626.balanceOf(user1.address);
      });

      it('emits a Depost event', async () => {
        const event = findEvent({ receipt, eventName: 'Deposit' });

        assert.equal(event.args.caller, user1.address);
        assert.equal(event.args.owner, user1.address);
        assertBn.equal(event.args.assets, user1Assets);
        assertBn.equal(event.args.shares, user1Shares);
      });

      it('updates the vault and underlying values', async () => {
        // 1:1 rate
        assertBn.equal(user1Shares, user1Assets);
        assertBn.equal(await ERC4626.convertToAssets(user1Shares), user1Assets);
        assertBn.equal(await ERC4626.previewDeposit(user1Assets), user1Shares);
        assertBn.equal(await ERC4626.previewWithdraw(user1Shares), user1Assets);

        // Balances
        assertBn.equal(await AssetToken.balanceOf(user1.address), 0);
        assertBn.equal(user1Shares, user1Shares);

        // Totals
        assertBn.equal(await ERC4626.totalSupply(), user1Shares);
        assertBn.equal(await ERC4626.totalAssets(), user1Assets);
      });

      describe('when the user Withdraw', () => {
        let receipt;
        before('do the withdrawal', async () => {
          const tx = await ERC4626.connect(user1).withdraw(
            user1Assets,
            user1.address,
            user1.address
          );
          receipt = await tx.wait();
        });

        it('emits a Withdraw event', async () => {
          const event = findEvent({ receipt, eventName: 'Withdraw' });

          assert.equal(event.args.caller, user1.address);
          assert.equal(event.args.receiver, user1.address);
          assert.equal(event.args.owner, user1.address);
          assertBn.equal(event.args.assets, user1Assets);
          assertBn.equal(event.args.shares, user1Shares);
        });

        it('updates the vault and underlying values', async () => {
          // Balances
          assertBn.equal(await AssetToken.balanceOf(user1.address), user1Assets);

          // Totals
          assertBn.equal(await ERC4626.totalSupply(), 0);
          assertBn.equal(await ERC4626.totalAssets(), 0);
        });
      });
    });
  });

  describe.skip('Single Mint and Redeem', () => {});

  describe.skip('Multiple operations', () => {});
});
