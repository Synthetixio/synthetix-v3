import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { BigNumber, constants, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';
import Permissions from '../../mixins/AccountRBACMixin.permissions';
import { verifyChecksCollateralEnabled, verifyUsesFeatureFlag } from '../../verifications';

const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

describe('IssueUSDModule', function () {
  const {
    signers,
    systems,
    provider,
    accountId,
    poolId,
    depositAmount,
    collateralAddress,
    collateralContract,
  } = bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer, user3: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: BigNumber;

  const feeAddress = '0x1234567890123456789012345678901234567890';

  before('identify signers', async () => {
    [owner, user1, user2, user3] = signers();
  });

  before('deploy and connect fake market', async () => {
    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

    await systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, user1.getAddress());

    marketId = await systems().Core.connect(user1).callStatic.registerMarket(MockMarket.address);

    await systems().Core.connect(user1).registerMarket(MockMarket.address);

    await MockMarket.connect(owner).initialize(
      systems().Core.address,
      marketId,
      ethers.utils.parseEther('1')
    );

    await systems()
      .Core.connect(owner)
      .setPoolConfiguration(poolId, [
        {
          marketId: marketId,
          weightD18: ethers.utils.parseEther('1'),
          maxDebtShareValueD18: ethers.utils.parseEther('10000000000000000'),
        },
      ]);

    await systems()
      .Core.connect(owner)
      .configureCollateral({
        tokenAddress: await systems().Core.getUsdToken(),
        oracleNodeId: ethers.utils.formatBytes32String(''),
        issuanceRatioD18: bn(150),
        liquidationRatioD18: bn(100),
        liquidationRewardD18: 0,
        minDelegationD18: 0,
        depositingEnabled: true,
      });
  });

  const restore = snapshotCheckpoint(provider);

  // eslint-disable-next-line max-params
  function verifyAccountState(
    accountId: number,
    poolId: number,
    collateralAmount: ethers.BigNumberish,
    debt: ethers.BigNumberish
  ) {
    return async () => {
      assertBn.equal(
        (await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress())).amount,
        collateralAmount
      );
      assertBn.equal(
        await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
        debt
      );
    };
  }

  describe('mintUsd()', async () => {
    before(restore);
    it('verifies permission for account', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount.mul(10)),
        `PermissionDenied("1", "${Permissions.MINT}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies sufficient c-ratio', async () => {
      const { issuanceRatioD18 } = await systems().Core.getCollateralConfiguration(
        collateralAddress()
      );
      const price = await systems().Core.getCollateralPrice(collateralAddress());

      await assertRevert(
        systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount),
        `InsufficientCollateralRatio("${depositAmount}", "${depositAmount}", "${price}", "${issuanceRatioD18}")`,
        systems().Core
      );
    });

    it('verifies pool exists', async () => {
      await assertRevert(
        systems().Core.connect(user1).mintUsd(
          accountId,
          845628, // invalid pool id
          collateralAddress(),
          depositAmount.div(10) // should be enough
        ),
        'PoolNotFound("845628")',
        systems().Core
      );
    });

    verifyChecksCollateralEnabled(
      () => systems().Core.connect(owner),
      collateralAddress,
      () =>
        systems().Core.connect(user1).mintUsd(
          accountId,
          poolId,
          collateralAddress(),
          depositAmount.div(10) // should be enough
        )
    );

    verifyUsesFeatureFlag(
      () => systems().Core,
      'mintUsd',
      () =>
        systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount.div(10))
    );

    describe('successful mint', () => {
      before('mint', async () => {
        await systems().Core.connect(user1).mintUsd(
          accountId,
          poolId,
          collateralAddress(),
          depositAmount.div(10) // should be enough
        );
        await systems()
          .Core.connect(user1)
          .withdraw(accountId, await systems().Core.getUsdToken(), depositAmount.div(10));
      });

      it(
        'has correct debt',
        verifyAccountState(accountId, poolId, depositAmount, depositAmount.div(10))
      );

      it('sent USD to user1', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await user1.getAddress()),
          depositAmount.div(10)
        );
      });

      it('decreased available capacity for market', async () => {
        assertBn.equal(
          await systems().Core.getWithdrawableMarketUsd(marketId),
          depositAmount.sub(depositAmount.div(10))
        );
      });

      describe('subsequent mint', () => {
        before('mint again', async () => {
          await systems().Core.connect(user1).mintUsd(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount.div(10) // should be enough
          );

          await systems()
            .Core.connect(user1)
            .withdraw(accountId, await systems().Core.getUsdToken(), depositAmount.div(10));
        });

        it(
          'has correct debt',
          verifyAccountState(accountId, poolId, depositAmount, depositAmount.div(5))
        );

        it('sent more USD to user1', async () => {
          assertBn.equal(
            await systems().USD.balanceOf(await user1.getAddress()),
            depositAmount.div(5)
          );
        });
      });
    });

    describe('mint/burn security check', () => {
      before(restore);

      before('mint', async () => {
        await systems().Core.connect(user1).mintUsd(
          accountId,
          poolId,
          collateralAddress(),
          depositAmount.div(10) // should be enough
        );
        await systems()
          .Core.connect(user1)
          .withdraw(accountId, await systems().Core.getUsdToken(), depositAmount.div(10));
      });

      it('does not let another user pay back the debt without balance', async () => {
        // User 1 mint some sUSD
        await systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount.div(10));
        // Mint some collateral for user3. It does not work without user3 having some collateral. (they will not loose any of this though.)
        await collateralContract().mint(await user3.getAddress(), depositAmount);
        const user3CollateralBalBefore = await collateralContract().balanceOf(
          await user3.getAddress()
        );
        const user3sUSDBalanceBefore = await systems().USD.balanceOf(await user3.getAddress());
        const user1DebtBefore = await systems()
          .Core.connect(user1)
          .callStatic.getPositionDebt(accountId, poolId, collateralAddress());

        const user1SusdBalanceBefore = await systems().USD.balanceOf(await user1.getAddress());
        console.log('user1DebtBefore', user1DebtBefore.toString());
        console.log('user1SusdBalanceBefore', user1SusdBalanceBefore.toString());
        console.log('user3CollateralBalBefore', user3CollateralBalBefore.toString());
        console.log('user3sUSDBalanceBefore', user3sUSDBalanceBefore.toString());
        console.log('Calling burnUSD connected as user3 but passing account id of user1...');
        console.log('Note that user 3 does not have any sUSD');

        // Try to burn for another user without having any sUSD
        await assertRevert(
          systems()
            .Core.connect(user3)
            .burnUsd(accountId, poolId, collateralAddress(), depositAmount.div(10)),
          'PermissionDenied'
        );

        const user3CollateralBalAfter = await collateralContract().balanceOf(
          await user3.getAddress()
        );
        const user3sUSDBalanceAfter = await systems().USD.balanceOf(await user3.getAddress());
        const user1DebtAfter = await systems()
          .Core.connect(user1)
          .callStatic.getPositionDebt(accountId, poolId, collateralAddress());

        const user1SusdBalanceAfter = await systems().USD.balanceOf(await user1.getAddress());

        console.log('Tx did not revert');
        console.log('user3CollateralBalAfter', user3CollateralBalAfter.toString());
        console.log('user3sUSDBalanceAfter', user3sUSDBalanceAfter.toString());
        console.log('user1DebtAfter', user1DebtAfter.toString());
        console.log('user1SusdBalanceAfter', user1SusdBalanceAfter.toString());
        console.log('User3 have the same amount of collateral, and still 0 sUSD');
        console.log('User1 now have less debt and the same amount of sUSD');
        assertBn.equal(user1DebtBefore, user1DebtAfter);
      });
    });

    describe('successful mint when fee is levied', async () => {
      before(restore);
      before('set fee', async () => {
        await systems()
          .Core.connect(owner)
          .setConfig(
            ethers.utils.formatBytes32String('mintUsd_feeRatio'),
            ethers.utils.hexZeroPad(ethers.utils.parseEther('0.01').toHexString(), 32)
          ); // 1% fee levy
        await systems()
          .Core.connect(owner)
          .setConfig(
            ethers.utils.formatBytes32String('mintUsd_feeAddress'),
            ethers.utils.hexZeroPad(feeAddress, 32)
          );
      });

      let tx: ethers.providers.TransactionResponse;

      before('mint', async () => {
        tx = await systems().Core.connect(user1).mintUsd(
          accountId,
          poolId,
          collateralAddress(),
          depositAmount.div(10) // should be enough
        );
        await systems()
          .Core.connect(user1)
          .withdraw(accountId, await systems().Core.getUsdToken(), depositAmount.div(10));
      });

      it(
        'has correct debt',
        verifyAccountState(
          accountId,
          poolId,
          depositAmount,
          depositAmount.div(10).add(depositAmount.div(1000))
        )
      );

      it('sent USD to user1', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await user1.getAddress()),
          depositAmount.div(10)
        );
      });

      it('sent USD to the fee address', async () => {
        assertBn.equal(await systems().USD.balanceOf(feeAddress), depositAmount.div(1000));
      });

      it('emitted event', async () => {
        await assertEvent(
          tx,
          `IssuanceFeePaid(${accountId}, ${poolId}, "${collateralAddress()}", ${depositAmount.div(
            1000
          )})`,
          systems().Core
        );
      });
    });
  });

  describe('burnUSD()', () => {
    before(restore);
    before('mint', async () => {
      await systems()
        .Core.connect(user1)
        .mintUsd(accountId, poolId, collateralAddress(), depositAmount.div(10));
      await systems()
        .Core.connect(user1)
        .withdraw(accountId, await systems().Core.getUsdToken(), depositAmount.div(10));
    });

    const restoreBurn = snapshotCheckpoint(provider);

    verifyUsesFeatureFlag(
      () => systems().Core,
      'burnUsd',
      () =>
        systems()
          .Core.connect(user1)
          .burnUsd(accountId, poolId, collateralAddress(), depositAmount.div(10))
    );

    describe('burn from other account', async () => {
      before(restoreBurn);
      before('transfer burn collateral', async () => {
        // send the collateral to account 2 so it can burn on behalf
        await systems()
          .USD.connect(user1)
          .transfer(await user2.getAddress(), depositAmount.div(10));
      });

      before('user deposit into other account', async () => {
        await systems()
          .USD.connect(user2)
          .approve(systems().Core.address, constants.MaxUint256.toString());
        await systems()
          .Core.connect(user2)
          .deposit(accountId, await systems().Core.getUsdToken(), depositAmount.div(10));
      });

      it('other account burn would revert', async () => {
        await assertRevert(
          systems()
            .Core.connect(user2)
            .burnUsd(accountId, poolId, collateralAddress(), depositAmount.div(10)),
          'PermissionDenied'
        );
      });

      it(
        'has correct debt',
        verifyAccountState(accountId, poolId, depositAmount, depositAmount.div(10))
      );

      it('did not took away from user2 balance', async () => {
        assertBn.equal(await systems().USD.balanceOf(await user2.getAddress()), 0);
      });
    });

    describe('successful partial burn when fee is levied', async () => {
      before(restoreBurn);
      before('set fee', async () => {
        await systems()
          .Core.connect(owner)
          .setConfig(
            ethers.utils.formatBytes32String('burnUsd_feeRatio'),
            ethers.utils.hexZeroPad(ethers.utils.parseEther('0.01').toHexString(), 32)
          ); // 1% fee levy
        await systems()
          .Core.connect(owner)
          .setConfig(
            ethers.utils.formatBytes32String('burnUsd_feeAddress'),
            ethers.utils.hexZeroPad(feeAddress, 32)
          );
      });

      before('account partial burn debt', async () => {
        await systems()
          .USD.connect(user1)
          .approve(systems().Core.address, constants.MaxUint256.toString());

        await systems()
          .Core.connect(user1)
          .deposit(
            accountId,
            await systems().Core.getUsdToken(),
            depositAmount.div(20).add(depositAmount.div(2000))
          );

        // in order to burn all with the fee we need a bit more
        await systems()
          .Core.connect(user1)
          .burnUsd(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount.div(20).add(depositAmount.div(2000))
          ); // pay off 50.5
      });

      it(
        'has correct debt',
        verifyAccountState(accountId, poolId, depositAmount, depositAmount.div(20))
      );

      it('took away from user1', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await user1.getAddress()),
          ethers.utils.parseEther('49.5')
        );
      });

      it('sent money to the fee address', async () => {
        assertBn.equal(await systems().USD.balanceOf(feeAddress), depositAmount.div(2000));
      });
    });

    describe('successful max burn when fee is levied', async () => {
      before(restoreBurn);

      before('acquire additional balance to pay off fee', async () => {
        await systems()
          .Core.connect(user1)
          .mintUsd(accountId, 0, collateralAddress(), depositAmount.div(1000));
      });

      before('set fee', async () => {
        await systems()
          .Core.connect(owner)
          .setConfig(
            ethers.utils.formatBytes32String('burnUsd_feeRatio'),
            ethers.utils.hexZeroPad(ethers.utils.parseEther('0.01').toHexString(), 32)
          ); // 1% fee levy
        await systems()
          .Core.connect(owner)
          .setConfig(
            ethers.utils.formatBytes32String('burnUsd_feeAddress'),
            ethers.utils.hexZeroPad(feeAddress, 32)
          );
      });

      let tx: ethers.providers.TransactionResponse;

      before('account partial burn debt', async () => {
        // in order to burn all with the fee we need a bit more
        await systems()
          .Core.connect(user1)
          .withdraw(accountId, await systems().Core.getUsdToken(), depositAmount.div(1000));

        await systems()
          .USD.connect(user1)
          .approve(systems().Core.address, constants.MaxUint256.toString());

        await systems()
          .Core.connect(user1)
          .deposit(
            accountId,
            await systems().Core.getUsdToken(),
            await systems().USD.balanceOf(await user1.getAddress())
          );

        tx = await systems()
          .Core.connect(user1)
          .burnUsd(accountId, poolId, collateralAddress(), depositAmount); // pay off everything
      });

      it('has correct debt', verifyAccountState(accountId, poolId, depositAmount, 0));

      it('took away from user1', async () => {
        assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), 0);
      });

      it('sent money to the fee address', async () => {
        assertBn.equal(await systems().USD.balanceOf(feeAddress), depositAmount.div(1000));
      });

      it('emitted event', async () => {
        await assertEvent(
          tx,
          `IssuanceFeePaid(${accountId}, ${poolId}, "${collateralAddress()}", ${depositAmount.div(
            1000
          )})`,
          systems().Core
        );
      });
    });
  });

  describe('edge case: verify debt is excluded from available mint', async () => {
    before(restore);
    afterEach(restore);

    function exploit(ratio: number) {
      return async () => {
        // Initial capacity
        const capacity = await systems().Core.connect(user1).getWithdrawableMarketUsd(marketId);

        // Mint USD against collateral
        await systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount.div(10).div(ratio));

        // Bypass MockMarket internal accounting
        await MockMarket.setReportedDebt(depositAmount);

        // Issue max capacity, which has not been reduced
        await assertRevert(
          MockMarket.connect(user1).sellSynth(capacity),
          'NotEnoughLiquidity(',
          systems().Core
        );

        // Should not have been allowed to mint more than the system limit
        /*assertBn.equal(
          await systems().USD.balanceOf(user1.getAddress()),
          depositAmount.div(10).div(ratio)
        );

        // cratio is exactly equal to 1 because that is what the system allows.
        assertBn.equal(
          await systems().Core.callStatic.getVaultCollateralRatio(poolId, collateralAddress()),
          ethers.utils.parseEther('1').div(ratio)
        );*/
      };
    }

    // thanks to iosiro for the below test
    // quite the edge case
    it('try to create unbacked debt', exploit(1));

    describe('adjust system max c ratio', async () => {
      before('adjust max liquidity ratio', async () => {
        await systems().Core['setMinLiquidityRatio(uint256)'](ethers.utils.parseEther('2'));
      });

      it('try to create debt beyond system max c ratio', exploit(2));
    });
  });

  describe('establish a more stringent collateralization ratio for the pool', async () => {
    before(restore);

    it('set the pool min collateral issuance ratio to 600%', async () => {
      await systems()
        .Core.connect(owner)
        .setPoolCollateralConfiguration(poolId, collateralAddress(), {
          collateralLimitD18: bn(10),
          issuanceRatioD18: bn(6),
        });
    });

    it('verifies sufficient c-ratio', async () => {
      const price = await systems().Core.getCollateralPrice(collateralAddress());

      await assertRevert(
        systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount),
        `InsufficientCollateralRatio("${depositAmount}", "${depositAmount}", "${price}", "${bn(
          6
        ).toString()}")`,
        systems().Core
      );
    });
  });
});
