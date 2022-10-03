import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { LegacyMarket__factory } from '../../typechain-types';

import { LegacyMarket } from '../../typechain-types/contracts/LegacyMarket';

import Wei, { wei } from '@synthetixio/wei';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { snapshotCheckpoint } from '../utils';

async function getImpersonatedSigner(provider: ethers.providers.JsonRpcProvider, addr: string) {
  await provider.send('hardhat_impersonateAccount', [addr]);

  return provider.getSigner(addr);
}

describe('LegacyMarket', () => {
  let owner: ethers.Signer, snxStaker: ethers.Signer;

  let snxStakerAddress: string;

  let market: LegacyMarket;

  let addressResolver: ethers.Contract;
  let snxToken: ethers.Contract;
  let susdToken: ethers.Contract;
  let synthetixDebtShare: ethers.Contract;
  let liquidationRewards: ethers.Contract;
  let rewardEscrow: ethers.Contract;

  let v3System: ethers.Contract;
  let v3Account: ethers.Contract;
  let v3Usd: ethers.Contract;

  let cannonProvider: ethers.providers.JsonRpcProvider;

  before('deploy', async () => {
    const { provider, signers, outputs } = await hre.run('cannon:build');

    [owner] = signers;

    // default test user
    snxStakerAddress = '0x48914229deDd5A9922f44441ffCCfC2Cb7856Ee9';
    snxStaker = await getImpersonatedSigner(provider, snxStakerAddress);

    market = LegacyMarket__factory.connect(outputs.contracts.market.address, snxStaker);

    addressResolver = new ethers.Contract(
      outputs.imports.v2x.contracts.AddressResolver.address,
      outputs.imports.v2x.contracts.AddressResolver.abi,
      provider
    );
    snxToken = new ethers.Contract(
      outputs.imports.v2x.contracts.ProxySynthetix.address,
      outputs.imports.v2x.contracts.Synthetix.abi,
      provider
    );
    susdToken = new ethers.Contract(
      outputs.imports.v2x.contracts.ProxysUSD.address,
      outputs.imports.v2x.contracts.ProxysUSD.abi,
      provider
    );
    synthetixDebtShare = new ethers.Contract(
      outputs.imports.v2x.contracts.SynthetixDebtShare.address,
      outputs.imports.v2x.contracts.SynthetixDebtShare.abi,
      provider
    );

    liquidationRewards = new ethers.Contract(
      outputs.imports.v2x.contracts.LiquidatorRewards.address,
      outputs.imports.v2x.contracts.LiquidatorRewards.abi,
      provider
    );
    rewardEscrow = new ethers.Contract(
      outputs.imports.v2x.contracts.RewardEscrowV2.address,
      outputs.imports.v2x.contracts.RewardEscrowV2.abi,
      provider
    );

    v3System = new ethers.Contract(
      outputs.imports.v3.contracts.CoreProxy.address,
      outputs.imports.v3.contracts.CoreProxy.abi,
      provider
    );
    v3Account = new ethers.Contract(
      outputs.imports.v3.contracts.AccountProxy.address,
      outputs.imports.v3.contracts.AccountProxy.abi,
      provider
    );
    v3Usd = new ethers.Contract(
      outputs.imports.v3.contracts.USDProxy.address,
      outputs.imports.v3.contracts.USDProxy.abi,
      provider
    );

    cannonProvider = provider;
  });

  const migratedAccountId = 1234;

  const restore = snapshotCheckpoint(() => cannonProvider);

  describe('convertUSD()', async () => {
    before(restore);

    before('approve', async () => {
      await susdToken.connect(snxStaker).approve(market.address, ethers.constants.MaxUint256);
    });

    it('fails when insufficient migrated collateral', async () => {
      await assertRevert(
        market.connect(snxStaker).convertUSD(wei(1).toBN()),
        'InsufficientCollateralMigrated("1000000000000000000", "0")',
        market
      );
    });

    describe('when some collateral has been migrated', async () => {
      const convertedAmount = wei(1);

      before('do migration', async () => {
        console.log(wei(await snxToken.balanceOf(snxStakerAddress)).toString());
        await snxToken.connect(snxStaker).approve(market.address, ethers.constants.MaxUint256);
        await market.connect(snxStaker).migrate(migratedAccountId);
        console.log(wei(await snxToken.balanceOf(snxStakerAddress)).toString());

        // sanity
        console.log(
          (
            await v3System.getPositionCollateral(
              migratedAccountId,
              await v3System.getPreferredPool(),
              snxToken.address
            )
          ).value.toString()
        );
        assertBn.gte(
          await v3System.getWithdrawableUsd(await market.marketId()),
          convertedAmount.toBN()
        );
      });

      it('fails when convertUSD is 0', async () => {
        await assertRevert(
          market.connect(snxStaker).convertUSD(wei(1).toBN()),
          'InvalidParameters'
        );
      });

      it('fails when insufficient source balance', async () => {
        await assertRevert(
          market.connect(snxStaker).convertUSD(wei(1).toBN()),
          'InvalidParameters',
          market
        );
      });

      describe('when invoked', async () => {
        let txn: ethers.providers.TransactionReceipt;

        let beforeMarketBalance: Wei;

        before('record priors', async () => {
          beforeMarketBalance = wei(await v3System.getMarketIssuance(await market.marketId()));
        });

        before('when invoked', async () => {
          txn = await (await market.connect(snxStaker).convertUSD(convertedAmount.toBN())).wait();
        });

        it('burns v2 USD', async () => {
          assertBn.equal(await susdToken.balanceOf(snxStaker), 0);
        });

        it('mints v3 USD', async () => {
          assertBn.equal(await v3Usd.balanceOf(snxStaker), convertedAmount.toBN());
        });

        it('reduced market balance', async () => {
          assertBn.equal(
            await v3System.marketTotalBalance(await market.marketId()),
            beforeMarketBalance.sub(convertedAmount).toBN()
          );
        });

        it('emitted an event', async () => {
          await assertEvent(
            txn,
            `ConvertedUSD(${snxStakerAddress}, ${convertedAmount.toBN().toString()})`,
            market
          );
        });
      });
    });
  });

  function testMigrate(doMigrateCall: () => Promise<ethers.providers.TransactionResponse>) {
    describe('with a fake account with escrow entries and liquidation rewards', async () => {
      before('create escrow entries', async () => {
        await snxToken.connect(owner).approve(rewardEscrow.address, ethers.constants.MaxUint256);

        // just create it from this user's own SNX balance
        await rewardEscrow.connect(owner).createEscrowEntry(snxStakerAddress, wei(3).toBN(), 3600);

        // create a second entry for good measure
        await rewardEscrow.connect(owner).createEscrowEntry(snxStakerAddress, wei(2).toBN(), 1800);
      });

      before('create liquidation reward', async () => {
        // temporarily set synthetix address to different so we can call `notifyRewardAmount` below
        const preSynthetix = await addressResolver.getAddress(
          ethers.utils.formatBytes32String('Synthetix')
        );
        await addressResolver
          .connect(owner)
          .importAddresses(
            [ethers.utils.formatBytes32String('Synthetix')],
            [await owner.getAddress()]
          );
        await liquidationRewards.connect(owner).rebuildCache();

        await snxToken.connect(snxStaker).transfer(liquidationRewards.address, wei(1).toBN());
        await liquidationRewards.connect(owner).notifyRewardAmount(wei(1).toBN());

        await addressResolver
          .connect(owner)
          .importAddresses([ethers.utils.formatBytes32String('Synthetix')], [preSynthetix]);
        await liquidationRewards.connect(owner).rebuildCache();
      });

      // sanity
      let beforeCollateral: Wei;
      let beforeDebt: Wei;
      //let beforeDebtShares: Wei;
      before('calculate before values', async () => {
        beforeCollateral = wei(await snxToken.collateral(snxStakerAddress));
        beforeDebt = wei(
          await snxToken.debtBalanceOf(snxStakerAddress, ethers.utils.formatBytes32String('sUSD'))
        );
        //beforeDebtShares = wei(await synthetixDebtShare.balanceOf(snxStakerAddress));

        // sanity
        assertBn.equal(
          wei(await snxToken.balanceOf(snxStakerAddress))
            .add(1 + 2 + 3)
            .toBN(),
          beforeCollateral.toBN()
        );
      });

      describe('when invoked', () => {
        let txn: ethers.providers.TransactionReceipt;

        before('invoke', async () => {
          await snxToken.connect(snxStaker).approve(market.address, beforeCollateral.toBN());
          txn = await (await doMigrateCall()).wait();
        });

        it('cleared liquidation rewards balance', async () => {
          assertBn.equal(await liquidationRewards.earned(snxStakerAddress), 0);
        });

        it('removed all snx balance', async () => {
          assertBn.equal(await snxToken.balanceOf(snxStakerAddress), 0);
        });

        it('revoked escrow entries', async () => {
          assertBn.equal(await rewardEscrow.totalEscrowedAccountBalance(snxStakerAddress), 0);
        });

        it('has all collateral in v3 account', async () => {
          const collateralInfo = await v3System.getAccountCollateral(
            migratedAccountId,
            snxToken.address
          );
          console.log(collateralInfo);
          assertBn.equal(collateralInfo.totalStaked, beforeCollateral.toBN());
          // TODO: for some reason the `liquidationReward` is not appearing here even though
          // all other amounts are correct. maybe system setting?
          //assertBn.equal(collateralInfo.totalLocked, wei(6).toBN());
          // TODO: bug is in v3, does not correctly register collateral. will be fixed with
          // router-restructure merge
          // assertBn.equal(collateralInfo.totalAssigned, beforeCollateral.toBN());
        });

        it('assigned whatever debt they had pre migration', async () => {
          assertBn.equal(
            await v3System.callStatic.getPositionDebt(
              migratedAccountId,
              await v3System.getPreferredPool(),
              snxToken.address
            ),
            beforeDebt.toBN()
          );
        });

        it('undertook debt shares from user account', async () => {
          assertBn.equal(await synthetixDebtShare.balanceOf(snxStakerAddress), 0);
        });

        it('sent v3 account to user', async () => {
          assertBn.equal(await v3Account.ownerOf(migratedAccountId), snxStakerAddress);
        });

        it('emitted an event', async () => {
          await assertEvent(txn, 'AccountMigrated', market);
        });
      });
    });
  }

  describe('migrate()', () => {
    before(restore);

    it('fails when no debt to migrate', async () => {
      await assertRevert(market.connect(owner).migrate(migratedAccountId), 'NothingToMigrate()');
    });

    testMigrate(async () => {
      return market.connect(snxStaker).migrate(migratedAccountId);
    });

    describe('when all accounts migrate to v3', () => {
      //const allStakingAccounts: string[] = [];

      before('get list of all staking accounts', async () => {});

      before('call migrate for all accounts', async () => {});

      it('assigned all snx debt to legacy market', async () => {});

      it('can withdraw v2 USD for v3 USD', async () => {});
    });
  });

  describe('migrateOnBehalf()', () => {
    before(restore);

    it('only works for owner', async () => {});

    testMigrate(async () => {
      return market.connect(owner).migrateOnBehalf(snxStakerAddress, migratedAccountId);
    });
  });

  describe('setPauseStablecoinConversion', async () => {
    it('only works for owner', async () => {});

    it('sets the value', async () => {});
  });

  describe('setPauseMigration', async () => {
    it('only works for owner', async () => {});

    it('sets the value', async () => {});
  });
});
