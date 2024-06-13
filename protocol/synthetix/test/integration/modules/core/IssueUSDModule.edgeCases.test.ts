import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';

const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

describe('IssueUSDModule', function () {
  const { signers, systems, provider, accountId, poolId, depositAmount, collateralAddress } =
    bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: BigNumber;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  before('deploy and connect fake market', async () => {
    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

    await systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, await user1.getAddress());

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
