/* eslint-disable @typescript-eslint/ban-ts-comment */
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import hre from 'hardhat';
//@ts-ignore
import { IV3CoreProxy, LegacyMarket__factory } from '../../typechain-types';
//@ts-ignore
import { LegacyMarket } from '../../typechain-types/contracts/LegacyMarket';

import Wei, { wei } from '@synthetixio/wei';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { snapshotCheckpoint } from '../utils';

async function getImpersonatedSigner(
  provider: ethers.providers.JsonRpcProvider,
  addr: string
): Promise<ethers.Signer> {
  await provider.send('hardhat_impersonateAccount', [addr]);

  return provider.getSigner(addr);
}

async function doForkDeploy() {
  return await hre.run('cannon:deploy', {
    dryRun: true,
    impersonate: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    fundSigners: true,
  });
}

describe('LegacyMarket', function () {
  this.timeout(360000);
  let owner: ethers.Signer, snxStaker: ethers.Signer;

  let snxStakerAddress: string;

  let market: LegacyMarket;

  let addressResolver: ethers.Contract;
  let snxToken: ethers.Contract;
  let susdToken: ethers.Contract;
  let synthetixDebtShare: ethers.Contract;
  let liquidationRewards: ethers.Contract;
  let rewardEscrow: ethers.Contract;
  let snxDistributor: ethers.Contract;

  let v3System: ethers.Contract;
  let v3Account: ethers.Contract;
  let v3Usd: ethers.Contract;

  let cannonProvider: ethers.providers.JsonRpcProvider;

  before('deploy', async () => {
    const {
      provider: rawProvider,
      signers,
      outputs,
    } = hre.network.name === 'cannon'
      ? await hre.run('cannon:build', { cannonfile: 'cannonfile.test.toml' })
      : await doForkDeploy();

    const provider = new ethers.providers.Web3Provider(rawProvider);

    owner = provider.getSigner(signers[0].address);

    // default test user
    snxStakerAddress = '0x48914229deDd5A9922f44441ffCCfC2Cb7856Ee9';
    snxStaker = await getImpersonatedSigner(provider, snxStakerAddress);

    market = LegacyMarket__factory.connect(outputs.contracts.Proxy.address, snxStaker);

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
    ) as IV3CoreProxy;
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

    snxDistributor = new ethers.Contract(
      outputs.contracts.SNXDistributor.address,
      outputs.contracts.SNXDistributor.abi
    );

    await rewardEscrow
      .connect(await getImpersonatedSigner(provider, await rewardEscrow.owner()))
      .setPermittedEscrowCreator(await owner.getAddress(), true);

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
        await snxToken.connect(snxStaker).approve(market.address, ethers.constants.MaxUint256);
        await market.connect(snxStaker).migrate(migratedAccountId);

        // sanity
        assertBn.gte(
          await v3System.getWithdrawableMarketUsd(await market.marketId()),
          convertedAmount.toBN()
        );
      });

      it('fails when convertUSD is 0', async () => {
        await assertRevert(market.connect(snxStaker).convertUSD(0), 'InvalidParameter("amount"');
      });

      it('fails when insufficient source balance', async () => {
        // transfer away some of the sUSD so that we can see what happens when there is not balance
        await susdToken.connect(snxStaker).transfer(await owner.getAddress(), wei(500).toBN());
        await assertRevert(
          market.connect(snxStaker).convertUSD(wei(501).toBN()),
          'Error("Insufficient balance after any settlement owing")'
        );
      });

      describe('when invoked', async () => {
        let txn: ethers.providers.TransactionReceipt;

        let beforeMarketBalance: Wei;

        before('record priors', async () => {
          beforeMarketBalance = wei(await v3System.getMarketNetIssuance(await market.marketId()));
        });

        before('when invoked', async () => {
          txn = await (await market.connect(snxStaker).convertUSD(convertedAmount.toBN())).wait();
        });

        it('burns v2 USD', async () => {
          assertBn.equal(await susdToken.balanceOf(await snxStaker.getAddress()), wei(499).toBN());
        });

        it('mints v3 USD', async () => {
          assertBn.equal(
            await v3Usd.balanceOf(await snxStaker.getAddress()),
            convertedAmount.toBN()
          );
        });

        it('reduced market balance', async () => {
          assertBn.equal(
            await v3System.getMarketNetIssuance(await market.marketId()),
            beforeMarketBalance.add(convertedAmount).toBN()
          );
        });

        it('emitted an event', async () => {
          await assertEvent(
            txn,
            `ConvertedUSD("${snxStakerAddress}", ${convertedAmount.toBN().toString()})`,
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
        await rewardEscrow.connect(owner).createEscrowEntry(snxStakerAddress, wei(4).toBN(), 3600);

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

        // sanity
        assertBn.equal(
          wei(await snxToken.balanceOf(snxStakerAddress))
            .add(1 + 2 + 4)
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
          assertBn.equal(collateralInfo.totalDeposited, beforeCollateral.toBN());
          assertBn.equal(collateralInfo.totalLocked, wei(7).toBN());
          assertBn.equal(collateralInfo.totalAssigned, beforeCollateral.toBN());
        });

        it('assigned whatever debt they had pre migration', async () => {
          const debt = await v3System.callStatic.getPositionDebt(
            migratedAccountId,
            await v3System.getPreferredPool(),
            snxToken.address
          );

          assertBn.gte(debt, beforeDebt.toBN().sub(100));

          assertBn.lte(debt, beforeDebt.toBN().add(100));
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

    describe('when we have some collateral already deposited from outside the v3 market', () => {
      const accountId = 100;
      const delegateAmount = ethers.utils.parseEther('10000');

      before(restore);

      before('delegate collateral outside of market', async () => {
        // create user account
        await v3System.connect(owner)['createAccount(uint128)'](100);

        // approve
        await snxToken.connect(owner).approve(v3System.address, ethers.constants.MaxUint256);

        // stake collateral
        await v3System.connect(owner).deposit(accountId, snxToken.address, delegateAmount);

        // invest in the pool
        await v3System
          .connect(owner)
          .delegateCollateral(
            accountId,
            await v3System.getPreferredPool(),
            snxToken.address,
            delegateAmount,
            ethers.utils.parseEther('1')
          );

        // sanity
        assertBn.equal(
          await v3System.callStatic.getPositionDebt(
            accountId,
            await v3System.getPreferredPool(),
            snxToken.address
          ),
          0
        );
      });

      const restoreExistingLiquidity = snapshotCheckpoint(() => cannonProvider);

      describe('run a migration', () => {
        before(restoreExistingLiquidity);
        testMigrate(async () => {
          return market.connect(snxStaker).migrate(migratedAccountId);
        });

        describe('post check', async () => {
          it('should have no debt', async () => {
            assertBn.equal(
              await v3System.callStatic.getPositionDebt(
                accountId,
                await v3System.getPreferredPool(),
                snxToken.address
              ),
              0
            );
          });
        });
      });

      describe('run a migartion with insufficient liquidity', () => {
        before(restoreExistingLiquidity);

        before('create account with insufficient collateral', async () => {
          // bring it to a 10% effective c-ratio--below liquidation threshold, eligible for liquidation
          // we have the ratio so low just to make sure that the inverse condition is not being checked in the contract
          await snxToken
            .connect(snxStaker)
            .transfer(
              await owner.getAddress(),
              (await snxToken.connect(owner).balanceOf(snxStakerAddress)).sub(
                ethers.utils.parseEther('10')
              )
            );
        });

        describe('call migrate', async () => {
          before('do it', async () => {
            // should not fail but should do liquidation
            await market.connect(snxStaker).migrate(2873826);
          });

          it('account has not been created', async () => {
            if ((await v3System.getAccountOwner(2873826)) !== ethers.constants.AddressZero) {
              throw new Error('account was created');
            }
          });

          it('debt has increased for existing account', async () => {
            // there is only one account so the debt it should have should be the same as the actual amount
            assertBn.equal(
              await v3System.callStatic.getPositionDebt(
                accountId,
                await v3System.getPreferredPool(),
                snxToken.address
              ),
              ethers.utils.parseEther('1000')
            );
          });

          it('rewards available for distributed', async () => {
            assertBn.equal(
              await v3System
                .connect(owner)
                .callStatic.claimRewards(
                  accountId,
                  await v3System.getPreferredPool(),
                  snxToken.address,
                  snxDistributor.address
                ),
              ethers.utils.parseEther('10')
            );
          });

          describe('claim rewards from rewards distributor', async () => {
            let beforeBalance: ethers.BigNumberish;
            before('claim', async () => {
              beforeBalance = await snxToken.balanceOf(await owner.getAddress());
              await v3System
                .connect(owner)
                .claimRewards(
                  accountId,
                  await v3System.getPreferredPool(),
                  snxToken.address,
                  snxDistributor.address
                );
            });

            it('should have collateral in account', async () => {
              assertBn.equal(
                (await snxToken.balanceOf(await owner.getAddress())).sub(beforeBalance),
                ethers.utils.parseEther('10')
              );
            });
          });
        });
      });
    });

    // the below tests are fork only
    if (hre.network.name === 'cannon') {
      describe('when all accounts migrate to v3', function () {
        before('get list of all staking accounts', async () => {});

        before('call migrate for all accounts', async () => {});

        it('assigned all snx debt to legacy market', async () => {});

        it('can withdraw v2 USD for v3 USD', async () => {});
      });
    }
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

  describe('onERC721Received()', async () => {
    before(restore);
    it('fails if you just send an account token nft to the market without migrating', async () => {
      const func = 'safeTransferFrom(address,address,uint256)';
      await v3System.connect(owner)['createAccount(uint128)'](12341234);
      await assertRevert(
        v3Account.connect(owner)[func](await owner.getAddress(), market.address, 12341234),
        'InvalidTransferRecipient("0xD931006FdC3ba62E74Ae181CCBb1eA243AbE8956")',
        market
      );
    });
  });
});
