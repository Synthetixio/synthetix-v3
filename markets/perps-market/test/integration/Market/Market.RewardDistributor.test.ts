import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { createRewardsDistributor } from '../bootstrap';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('PerpsMarket: Reward Distributor configuration test', () => {
  const accountId = 4;
  const { systems, signers, trader1, owner, synthMarkets, provider } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(10_000),
        sellPrice: bn(10_000),
      },
    ],
    perpsMarkets: [], // don't create a market in bootstrap
    traderAccountIds: [accountId],
    collateralLiquidateRewardRatio: bn(0.42),
    skipRegisterDistributors: true,
  });

  let randomAccount: ethers.Signer;
  let wrongTokenAccount: ethers.Signer;

  let synthBTCMarketId: ethers.BigNumber;

  before('identify actors', async () => {
    [, , , , randomAccount, wrongTokenAccount] = signers();
    synthBTCMarketId = synthMarkets()[0].marketId(); // 2
  });

  let distributorAddress: string;
  let poolDelegatedCollateralTypes: string[];
  let tokenAddress: string;
  let distributorData: {
    tokenAddress: string;
    distributorAddress: string;
    syntMarketId: ethers.BigNumber;
    poolDelegatedCollateralTypes: string[];
  };
  before('get valid distributor data', async () => {
    tokenAddress = await randomAccount.getAddress();

    poolDelegatedCollateralTypes = [await randomAccount.getAddress()];
    distributorAddress = await createRewardsDistributor(
      owner(),
      systems().Core,
      systems().PerpsMarket,
      1,
      ethers.constants.AddressZero,
      tokenAddress,
      18,
      synthBTCMarketId
    );

    distributorData = {
      tokenAddress: tokenAddress,
      distributorAddress: distributorAddress,
      syntMarketId: synthBTCMarketId,
      poolDelegatedCollateralTypes: poolDelegatedCollateralTypes,
    };
  });

  const restoreToSetup = snapshotCheckpoint(provider);

  describe('initial configuration', () => {
    it('collateral liquidate reward ratio', async () => {
      assertBn.equal(await systems().PerpsMarket.getCollateralLiquidateRewardRatio(), bn(0.42));
    });
  });

  describe('attempt to change configuration errors', () => {
    it('reverts setting collateral liquidate reward ratio as non-owner', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(randomAccount).setCollateralLiquidateRewardRatio(bn(0.1337)),
        'Unauthorized'
      );
    });

    it('reverts registering a new distributor as non-owner', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(randomAccount)
          .registerDistributor(
            distributorData.tokenAddress,
            distributorData.distributorAddress,
            distributorData.syntMarketId,
            distributorData.poolDelegatedCollateralTypes
          ),
        'Unauthorized'
      );
    });

    it('reverts registering a new distributor with wrong data: collateralId', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            distributorData.tokenAddress,
            distributorData.distributorAddress,
            42,
            distributorData.poolDelegatedCollateralTypes
          ),
        'InvalidId("42")'
      );
    });

    it('reverts registering a new distributor with wrong data: distributor address zero', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            distributorData.tokenAddress,
            ethers.constants.AddressZero,
            distributorData.syntMarketId,
            distributorData.poolDelegatedCollateralTypes
          ),
        'ZeroAddress()'
      );
    });

    it('reverts registering a new distributor with wrong data: poolDelegatedCollateralTypes empty', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            distributorData.tokenAddress,
            distributorData.distributorAddress,
            distributorData.syntMarketId,
            []
          ),
        'InvalidParameter("collateralTypes", "must not be empty")'
      );
    });

    it('reverts registering a new distributor with wrong data: poolDelegatedCollateralTypes includes zeroAddress', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            distributorData.tokenAddress,
            distributorData.distributorAddress,
            distributorData.syntMarketId,
            [ethers.constants.AddressZero]
          ),
        'ZeroAddress'
      );
    });

    it('reverts registering a new distributor with wrong data: token is zeroAddress', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            ethers.constants.AddressZero,
            distributorData.distributorAddress,
            distributorData.syntMarketId,
            distributorData.poolDelegatedCollateralTypes
          ),
        'ZeroAddress'
      );
    });

    it('reverts registering a new distributor with wrong data: wrong distributor contract', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            distributorData.tokenAddress,
            await randomAccount.getAddress(),
            distributorData.syntMarketId,
            distributorData.poolDelegatedCollateralTypes
          ),
        'InvalidDistributorContract'
      );
    });

    it('reverts registering a new distributor with wrong data: wrong distributor (wrong token)', async () => {
      const wrongTokenAddress = await wrongTokenAccount.getAddress();

      await assertRevert(
        systems().PerpsMarket.connect(owner()).registerDistributor(
          wrongTokenAddress, // token
          distributorData.distributorAddress,
          distributorData.syntMarketId,
          distributorData.poolDelegatedCollateralTypes
        ),
        `InvalidDistributor("${synthBTCMarketId}", "${wrongTokenAddress}")`
      );
    });
  });

  describe('update configuration', () => {
    describe('set collateral liquidate reward ratio', () => {
      let tx: ethers.ContractTransaction;

      before('set collateral liquidate reward ratio', async () => {
        tx = await systems()
          .PerpsMarket.connect(owner())
          .setCollateralLiquidateRewardRatio(bn(0.1337));
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `CollateralLiquidateRewardRatioSet(${bn(0.1337).toString()})`,
          systems().PerpsMarket
        );
      });

      it('collateral liquidate reward ratio is set', async () => {
        assertBn.equal(await systems().PerpsMarket.getCollateralLiquidateRewardRatio(), bn(0.1337));
      });
    });

    describe('register distributor', () => {
      let tx: ethers.ContractTransaction;

      before('register distributor', async () => {
        tx = await systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            distributorData.tokenAddress,
            distributorData.distributorAddress,
            distributorData.syntMarketId,
            distributorData.poolDelegatedCollateralTypes
          );
      });

      it('distribution address is not zero', async () => {
        assert.notEqual(distributorAddress, ethers.constants.AddressZero);
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `RewardDistributorRegistered("${distributorAddress}")`,
          systems().PerpsMarket
        );
      });

      it('distributor is registered', async () => {
        const registeredDistributorData =
          await systems().PerpsMarket.getRegisteredDistributor(synthBTCMarketId);
        assert.equal(registeredDistributorData.distributor, distributorAddress);

        assert.equal(registeredDistributorData.poolDelegatedCollateralTypes.length, 1);
        assert.equal(
          registeredDistributorData.poolDelegatedCollateralTypes[0],
          poolDelegatedCollateralTypes[0]
        );
      });
    });
  });

  describe('delegate collateral', () => {
    let tx: ethers.ContractTransaction;
    const delegatedCollateral = bn(1);

    describe('can delegate snxUSD (collateralId = 0)', () => {
      before('delegate collateral', async () => {
        tx = await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountId, 0, delegatedCollateral);
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `CollateralModified(${accountId.toString()}, ${bn(0).toString()}, ${delegatedCollateral.toString()}, "${await trader1().getAddress()}")`,
          systems().PerpsMarket
        );
      });

      it('has correct available margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(accountId),
          delegatedCollateral
        );
      });

      it('has correct withdrawable margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getWithdrawableMargin(accountId),
          delegatedCollateral
        );
      });
    });

    describe('fails to delegate other collateral without a registered distributor', () => {
      before(restoreToSetup);

      it('reverts delegate snxBTC (collateralId = 2)', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(trader1())
            .modifyCollateral(accountId, synthBTCMarketId, delegatedCollateral),
          `InvalidId("${synthBTCMarketId}")`
        );
      });
    });

    describe('can delegate other collateral when the distributor is registered', () => {
      const delegatedCollateralValue = delegatedCollateral.mul(10_000);
      before(restoreToSetup);

      before('register distributor', async () => {
        await systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            distributorData.tokenAddress,
            distributorData.distributorAddress,
            synthBTCMarketId,
            distributorData.poolDelegatedCollateralTypes
          );
      });

      before('get and approve synth collateral', async () => {
        // trade snxUSD for synth
        await systems()
          .SpotMarket.connect(trader1())
          .buy(synthBTCMarketId, bn(10_000 * 1000), 0, ethers.constants.AddressZero);

        // approve amount of collateral to be transfered to the market
        await synthMarkets()[0]
          .synth()
          .connect(trader1())
          .approve(systems().PerpsMarket.address, delegatedCollateral);
      });

      before('delegate collateral', async () => {
        tx = await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountId, synthBTCMarketId, delegatedCollateral);
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `CollateralModified(${accountId.toString()}, ${synthBTCMarketId.toString()}, ${delegatedCollateral.toString()}, "${await trader1().getAddress()}")`,
          systems().PerpsMarket
        );
      });

      it('has correct available margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(accountId),
          delegatedCollateralValue
        );
      });

      it('has correct withdrawable margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getWithdrawableMargin(accountId),
          delegatedCollateralValue
        );
      });
    });
  });
});
