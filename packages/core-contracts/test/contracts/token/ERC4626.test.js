const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { constants } = require('ethers');

describe('ERC4626', () => {
  let ERC4626, AssetToken;

  let user1, alice, bob;

  before('identify signers', async () => {
    [user1, alice, bob] = await ethers.getSigners();
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
      await tx.wait();
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
        assertBn.equal(await ERC4626.balanceOf(user1.address), user1Shares);

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

  describe('Single Mint and Redeem', () => {
    const user1Assets = ethers.BigNumber.from('1000000');
    let user1Shares;

    before('mint', async () => {
      const tx = await AssetToken.connect(user1).mint(user1Assets);
      await tx.wait();
    });

    after('burn', async () => {
      const tx = await AssetToken.connect(user1).burn(user1Assets);
      await tx.wait();
    });

    before('approves vault to use user1 assets', async () => {
      const tx = await AssetToken.connect(user1).approve(ERC4626.address, user1Assets);
      await tx.wait();
    });

    it('vault is approved to use user1 assets', async () => {
      user1Shares = await ERC4626.convertToShares(user1Assets);
      assertBn.equal(await AssetToken.allowance(user1.address, ERC4626.address), user1Shares);
    });

    describe('when user mints some assets', async () => {
      let receipt;
      before('do the mint', async () => {
        const tx = await ERC4626.connect(user1).mint(user1Assets, user1.address);
        receipt = await tx.wait();
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
        assertBn.equal(await ERC4626.previewMint(user1Assets), user1Shares);
        assertBn.equal(await ERC4626.previewRedeem(user1Shares), user1Assets);

        // Balances
        assertBn.equal(await AssetToken.balanceOf(user1.address), 0);
        assertBn.equal(await ERC4626.balanceOf(user1.address), user1Shares);

        // Totals
        assertBn.equal(await ERC4626.totalSupply(), user1Shares);
        assertBn.equal(await ERC4626.totalAssets(), user1Assets);
      });

      describe('when the user Redeem', () => {
        let receipt;
        before('do the redeem', async () => {
          const tx = await ERC4626.connect(user1).redeem(user1Shares, user1.address, user1.address);
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

  describe('Multiple operations', () => {
    let aShares, aAssets, bShares, bAssets, vShares, vAssets;

    let preMutationShareBal, preMutationBal;

    let receipt;

    // Scenario:
    // A = Alice, B = Bob
    //  ________________________________________________________
    // | Vault shares | A share | A assets | B share | B assets |
    // |========================================================|
    // | 1. Alice mints 2000 shares (costs 2000 tokens)         |
    // |--------------|---------|----------|---------|----------|
    // |         2000 |    2000 |     2000 |       0 |        0 |
    // |--------------|---------|----------|---------|----------|
    // | 2. Bob deposits 4000 tokens (mints 4000 shares)        |
    // |--------------|---------|----------|---------|----------|
    // |         6000 |    2000 |     2000 |    4000 |     4000 |
    // |--------------|---------|----------|---------|----------|
    // | 3. Vault mutates by +3000 tokens...                    |
    // |    (simulated yield returned from strategy)...         |
    // |--------------|---------|----------|---------|----------|
    // |         6000 |    2000 |     3000 |    4000 |     6000 |
    // |--------------|---------|----------|---------|----------|
    // | 4. Alice deposits 2000 tokens (mints 1333 shares)      |
    // |--------------|---------|----------|---------|----------|
    // |         7333 |    3333 |     4999 |    4000 |     6000 |
    // |--------------|---------|----------|---------|----------|
    // | 5. Bob mints 2000 shares (costs 3001 assets)           |
    // |    NOTE: Bob's assets spent got rounded up             |
    // |    NOTE: Alice's vault assets got rounded up           |
    // |--------------|---------|----------|---------|----------|
    // |         9333 |    3333 |     5000 |    6000 |     9000 |
    // |--------------|---------|----------|---------|----------|
    // | 6. Vault mutates by +3000 tokens...                    |
    // |    (simulated yield returned from strategy)            |
    // |    NOTE: Vault holds 17001 tokens, but sum of          |
    // |          assetsOf() is 17000.                          |
    // |--------------|---------|----------|---------|----------|
    // |         9333 |    3333 |     6071 |    6000 |    10929 |
    // |--------------|---------|----------|---------|----------|
    // | 7. Alice redeem 1333 shares (2428 assets)              |
    // |--------------|---------|----------|---------|----------|
    // |         8000 |    2000 |     3643 |    6000 |    10929 |
    // |--------------|---------|----------|---------|----------|
    // | 8. Bob withdraws 2928 assets (1608 shares)             |
    // |--------------|---------|----------|---------|----------|
    // |         6392 |    2000 |     3643 |    4392 |     8000 |
    // |--------------|---------|----------|---------|----------|
    // | 9. Alice withdraws 3643 assets (2000 shares)           |
    // |    NOTE: Bob's assets have been rounded back up        |
    // |--------------|---------|----------|---------|----------|
    // |         4392 |       0 |        0 |    4392 |     8001 |
    // |--------------|---------|----------|---------|----------|
    // | 10. Bob redeem 4392 shares (8001 tokens)               |
    // |--------------|---------|----------|---------|----------|
    // |            0 |       0 |        0 |       0 |        0 |
    // |______________|_________|__________|_________|__________|

    before('mint Alice and Bob assets', async () => {
      let tx;
      const aliceInitialMint = ethers.BigNumber.from(4000);
      const bobInitialMint = ethers.BigNumber.from(7001);

      tx = await AssetToken.connect(alice).mint(aliceInitialMint);
      await tx.wait();
      tx = await AssetToken.connect(alice).approve(ERC4626.address, aliceInitialMint);
      await tx.wait();

      tx = await AssetToken.connect(bob).mint(bobInitialMint);
      await tx.wait();
      tx = await AssetToken.connect(bob).approve(ERC4626.address, bobInitialMint);
      await tx.wait();

      assertBn.equal(await AssetToken.allowance(alice.address, ERC4626.address), aliceInitialMint);
      assertBn.equal(await AssetToken.allowance(bob.address, ERC4626.address), bobInitialMint);

      assertBn.equal(await AssetToken.balanceOf(alice.address), aliceInitialMint);
      assertBn.equal(await AssetToken.balanceOf(bob.address), bobInitialMint);
    });

    after('burn A and B assets', async () => {
      let tx;

      tx = await AssetToken.connect(alice).burn(4000);
      await tx.wait();
      tx = await AssetToken.connect(bob).burn(7001);
      await tx.wait();
    });

    describe('step 1 - Alice mints 2000 shares', async () => {
      before('Alice mints 2000 shares', async () => {
        const tx = await ERC4626.connect(alice).mint(ethers.BigNumber.from(2000), alice.address);
        receipt = await tx.wait();

        const event = findEvent({ receipt, eventName: 'Deposit' });

        aAssets = event.args.assets;
      });

      it('has the right values', async () => {
        aShares = await ERC4626.previewDeposit(2000);

        // Expect to have received the requested mint amount.
        assertBn.equal(aShares, 2000);
        assertBn.equal(await ERC4626.balanceOf(alice.address), aShares);
        assertBn.equal(
          await ERC4626.convertToAssets(await ERC4626.balanceOf(alice.address)),
          aAssets
        );
        assertBn.equal(
          await ERC4626.convertToShares(aAssets),
          await ERC4626.balanceOf(alice.address)
        );

        // Expect a 1:1 ratio before mutation.
        assertBn.equal(aAssets, 2000);

        // Sanity check.
        assertBn.equal(await ERC4626.totalSupply(), aShares);
        assertBn.equal(await ERC4626.totalAssets(), aAssets);
      });
    });

    describe('step 2 - Bob deposits 4000 tokens (mints 4000 shares)', async () => {
      before('Bob deposits 4000 tokens', async () => {
        const tx = await ERC4626.connect(bob).deposit(ethers.BigNumber.from(4000), bob.address);
        receipt = await tx.wait();

        const event = findEvent({ receipt, eventName: 'Deposit' });

        bShares = event.args.shares;
      });

      it('has the right values', async () => {
        bAssets = await ERC4626.previewWithdraw(bShares);

        // Expect to have received the requested mint amount.
        assertBn.equal(bAssets, 4000);
        assertBn.equal(await ERC4626.balanceOf(bob.address), bShares);
        assertBn.equal(
          await ERC4626.convertToAssets(await ERC4626.balanceOf(bob.address)),
          bAssets
        );
        assertBn.equal(
          await ERC4626.convertToShares(bAssets),
          await ERC4626.balanceOf(bob.address)
        );

        // Expect a 1:1 ratio before mutation.
        assertBn.equal(bAssets, bShares);

        // Sanity check.
        preMutationShareBal = aShares.add(bShares);
        preMutationBal = aAssets.add(bAssets);

        assertBn.equal(await ERC4626.totalSupply(), preMutationShareBal);
        assertBn.equal(await ERC4626.totalAssets(), preMutationBal);
        assertBn.equal(await ERC4626.totalSupply(), 6000);
        assertBn.equal(await ERC4626.totalAssets(), 6000);
      });
    });

    describe('step 3 - Vault mutates by +3000 tokens... ', async () => {
      const mutationUnderlyingAmount = ethers.BigNumber.from(3000);
      before('Vault mutates by +3000 tokens...', async () => {
        // 3. Vault mutates by +3000 tokens...                    |
        //    (simulated yield returned from strategy)...
        // The Vault now contains more tokens than deposited which causes the exchange rate to change.
        // Alice share is 33.33% of the Vault, Bob 66.66% of the Vault.
        // Alice's share count stays the same but the underlying amount changes from 2000 to 3000.
        // Bob's share count stays the same but the underlying amount changes from 4000 to 6000.

        const tx = await AssetToken.connect(user1).mintTo(
          ERC4626.address,
          mutationUnderlyingAmount
        );
        await tx.wait();
      });

      it('has the right values', async () => {
        const aliceShares = await ERC4626.balanceOf(alice.address);
        const bobShares = await ERC4626.balanceOf(bob.address);
        // Vault values
        assertBn.equal(await ERC4626.totalSupply(), preMutationShareBal);
        assertBn.equal(await ERC4626.totalAssets(), preMutationBal.add(mutationUnderlyingAmount));

        // Alice values
        assertBn.equal(aliceShares, aShares);
        assertBn.equal(
          await ERC4626.convertToAssets(aliceShares),
          aAssets.add(mutationUnderlyingAmount.div(3).mul(1))
        );

        // Bob values
        assertBn.equal(bobShares, bShares);
        assertBn.equal(
          await ERC4626.convertToAssets(bobShares),
          bAssets.add(mutationUnderlyingAmount.div(3).mul(2))
        );
      });
    });

    describe('step 4 - Alice deposits 2000 tokens (mints 1333 shares)', async () => {
      before('Alice deposits 2000 tokens', async () => {
        const tx = await ERC4626.connect(alice).deposit(ethers.BigNumber.from(2000), alice.address);
        receipt = await tx.wait();
      });

      it('has the right values', async () => {
        // vault
        assertBn.equal(await ERC4626.totalSupply(), 7333);

        // alice
        assertBn.equal(await ERC4626.balanceOf(alice.address), 3333);
        assertBn.equal(await ERC4626.convertToAssets(await ERC4626.balanceOf(alice.address)), 4999);

        // bob
        assertBn.equal(await ERC4626.balanceOf(bob.address), 4000);
        assertBn.equal(await ERC4626.convertToAssets(await ERC4626.balanceOf(bob.address)), 6000);
      });
    });

    describe('step 5 - Bob mints 2000 shares (costs 3001 assets)', async () => {
      before('Bob mints 2000 shares', async () => {
        const tx = await ERC4626.connect(bob).mint(ethers.BigNumber.from(2000), bob.address);
        receipt = await tx.wait();
      });

      it('has the right values', async () => {
        // TODO Check rounded additions

        // NOTE: Bob's assets spent got rounded up
        // NOTE: Alices's vault assets got rounded up

        // vault
        assertBn.equal(await ERC4626.totalSupply(), 9333);

        // alice
        assertBn.equal(await ERC4626.balanceOf(alice.address), 3333);
        assertBn.equal(await ERC4626.convertToAssets(await ERC4626.balanceOf(alice.address)), 4999); // should be 5000

        // bob
        assertBn.equal(await ERC4626.balanceOf(bob.address), 6000);
        assertBn.equal(await ERC4626.convertToAssets(await ERC4626.balanceOf(bob.address)), 9000);

        // Sanity check
        assertBn.equal(await AssetToken.balanceOf(alice.address), 0);
        assertBn.equal(await AssetToken.balanceOf(bob.address), 1); // Should be 0
        // Assets in vault: 4k (alice) + 7k (bob) + 3k (yield) + 1 (round up)
        assertBn.equal(await ERC4626.totalAssets(), 14000); // Should be 14001
      });
    });

    describe('step 6 - Vault mutates by +3000 tokens', async () => {});
    describe('step 7', async () => {});
    describe('step 8', async () => {});
    describe('step 9', async () => {});
    describe('step 10', async () => {});
  });
});
