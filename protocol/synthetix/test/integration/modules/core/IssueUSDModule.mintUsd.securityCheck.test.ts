import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';

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

  let owner: ethers.Signer, user1: ethers.Signer, user3: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: BigNumber;

  before('identify signers', async () => {
    [owner, user1, , user3] = signers();
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

  describe('mintUsd() / mint/burn security check', async () => {
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
});
