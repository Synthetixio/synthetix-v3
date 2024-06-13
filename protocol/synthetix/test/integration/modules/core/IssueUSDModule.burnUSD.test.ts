import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { BigNumber, constants, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';
import { verifyUsesFeatureFlag } from '../../verifications';

const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

describe('IssueUSDModule', function () {
  const { signers, systems, provider, accountId, poolId, depositAmount, collateralAddress } =
    bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: BigNumber;

  const feeAddress = '0x1234567890123456789012345678901234567890';

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
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

  // eslint-disable-next-line max-params
  function verifyAccountState(
    accountId: number,
    poolId: number,
    collateralAmount: ethers.BigNumberish,
    debt: ethers.BigNumberish
  ) {
    return async () => {
      assertBn.equal(
        await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress()),
        collateralAmount
      );
      assertBn.equal(
        await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
        debt
      );
    };
  }

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

      it('no event emitted when fee address is 0', async () => {
        await systems()
          .Core.connect(owner)
          .setConfig(
            ethers.utils.formatBytes32String('burnUsd_feeAddress'),
            ethers.utils.hexZeroPad(ethers.constants.AddressZero, 32)
          );
        await assertEvent(tx, `IssuanceFeePaid`, systems().Core, true);
      });
    });
  });
});
