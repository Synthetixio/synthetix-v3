import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
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

  const feeAddress = '0x1234567890123456789012345678901234567890';

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

  describe('mintUsd() / successful mint when fee is levied', async () => {
    before(restore);

    let tx: ethers.providers.TransactionResponse;

    before(async () => {
      // set fee
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

      // mint
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
    it('no event emitted when fee address is 0', async () => {
      await systems()
        .Core.connect(owner)
        .setConfig(
          ethers.utils.formatBytes32String('mintUsd_feeAddress'),
          ethers.utils.hexZeroPad(ethers.constants.AddressZero, 32)
        );
      await assertEvent(tx, `IssuanceFeePaid`, systems().Core, true);
    });
  });
});
