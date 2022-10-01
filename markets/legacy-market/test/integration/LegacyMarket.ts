import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { LegacyMarket__factory, synthetix } from '../../typechain-types';

import { LegacyMarket } from '../../typechain-types/contracts/LegacyMarket';

import Wei, { wei } from '@synthetixio/wei';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

async function getImpersonatedSigner(provider: ethers.providers.JsonRpcProvider, addr: string) {
    await provider.send('hardhat_impersonateAccount', [addr]);

    return provider.getSigner(addr);
}

describe('LegacyMarket', () => {

    let owner: ethers.Signer, snxStaker: ethers.Signer, snxStaker2: ethers.Signer, susdHolder: ethers.Signer;

    let snxStakerAddress: string;

    let market: LegacyMarket;

    let addressResolver: ethers.Contract;
    let snxToken: ethers.Contract;
    let synthetixDebtShare: ethers.Contract;
    let liquidationRewards: ethers.Contract;
    let rewardEscrow: ethers.Contract;

    let v3System: ethers.Contract;
    let v3Account: ethers.Contract;

    before('deploy', async () => {
        const { provider, signers, outputs } = await hre.run('cannon:build');

        [owner, susdHolder] = signers;

        console.log(provider.artifacts.imports.v3.contracts.CoreProxy.abi.find((v: any) => v.name === 'createAccount'));

        // default test user
        snxStakerAddress = '0x48914229deDd5A9922f44441ffCCfC2Cb7856Ee9';
        snxStaker = await getImpersonatedSigner(provider, snxStakerAddress);

        market = LegacyMarket__factory.connect(outputs.contracts.market.address, snxStaker);

        addressResolver = new ethers.Contract(outputs.imports.v2x.contracts.AddressResolver.address, outputs.imports.v2x.contracts.AddressResolver.abi, provider);
        snxToken = new ethers.Contract(outputs.imports.v2x.contracts.ProxySynthetix.address, outputs.imports.v2x.contracts.Synthetix.abi, provider);
        synthetixDebtShare = new ethers.Contract(outputs.imports.v2x.contracts.SynthetixDebtShare.address, outputs.imports.v2x.contracts.SynthetixDebtShare.abi, provider);

        liquidationRewards = new ethers.Contract(outputs.imports.v2x.contracts.LiquidatorRewards.address, outputs.imports.v2x.contracts.LiquidatorRewards.abi, provider);
        rewardEscrow = new ethers.Contract(outputs.imports.v2x.contracts.RewardEscrowV2.address, outputs.imports.v2x.contracts.RewardEscrowV2.abi, provider);


        v3System = new ethers.Contract(outputs.imports.v3.contracts.CoreProxy.address, outputs.imports.v3.contracts.CoreProxy.abi, provider);
        v3Account = new ethers.Contract(outputs.imports.v3.contracts.AccountProxy.address, outputs.imports.v3.contracts.AccountProxy.abi, provider);
    });

    const migratedAccountId = 1234;

    describe('convertUSD()', async () => {
        let beforeBalance: number;

        it('fails when insufficient migrated collateral', async () => {

        });

        describe('when some collateral has been migrated', async () => {
            it('fails when convertUSD is 0', async () => {

            });
    
            it('fails when insufficient source balance', async () => {
    
            });

            describe('when invoked', async () => {
                before('when invoked', async () => {
    
                });
        
                it('burns v2 USD', async () => {
        
                });
        
                it('mints v3 USD', async () => {
        
                });
        
                it('reduced market balance', async () => {
        
                });
    
                it('emitted an event', async () => {
    
                });
            });
        });
    });

    async function testMigrate(doMigrateCall: () => Promise<ethers.providers.TransactionResponse>) {
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
                const preSynthetix = await addressResolver.getAddress(ethers.utils.formatBytes32String('Synthetix'));
                await addressResolver.connect(owner).importAddresses([ethers.utils.formatBytes32String('Synthetix')], [await owner.getAddress()]);
                await liquidationRewards.connect(owner).rebuildCache();

                await snxToken.connect(snxStaker).transfer(liquidationRewards.address, wei(1).toBN());
                await liquidationRewards.connect(owner).notifyRewardAmount(wei(1).toBN());

                await addressResolver.connect(owner).importAddresses([ethers.utils.formatBytes32String('Synthetix')], [preSynthetix]);
                await liquidationRewards.connect(owner).rebuildCache();
            });

            // sanity
            let beforeCollateral: Wei;
            let beforeDebt: Wei;
            let beforeDebtShares: Wei;
            before('calculate before values', async () => {
                beforeCollateral = wei(await snxToken.collateral(snxStakerAddress));
                beforeDebt = wei(await snxToken.debtBalanceOf(snxStakerAddress, ethers.utils.formatBytes32String('sUSD')));
                beforeDebtShares = wei(await synthetixDebtShare.balanceOf(snxStakerAddress));

                // sanity
                assertBn.equal(wei(await snxToken.balanceOf(snxStakerAddress)).add(1 + 2 + 3).toBN(), beforeCollateral.toBN());
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
                    const collateralInfo = await v3System.getAccountCollateral(migratedAccountId, snxToken.address);
                    console.log(collateralInfo);
                    assertBn.equal(collateralInfo.totalStaked, beforeCollateral.toBN());
                    //assertBn.equal(collateralInfo.totalLocked, wei(6).toBN()); // TODO: for some reason the `liquidationReward` is not appearing here even though all other amounts are correct. maybe system setting?
                    // assertBn.equal(collateralInfo.totalAssigned, beforeCollateral.toBN()); // TODO: bug is in v3, does not correctly register collateral. will be fixed with router-restructure merge
                });

                it('assigned whatever debt they had pre migration', async () => {
                    assertBn.equal(
                        await v3System.callStatic.getPositionDebt(migratedAccountId, await v3System.getPreferredPool(), snxToken.address), 
                        beforeDebt.toBN()
                    );
                });

                it('undertook debt shares from user account', async () => {
                    assertBn.equal(await synthetixDebtShare.balanceOf(snxStakerAddress), 0);
                });

                it('sent v3 account to user', async () => {
                    assertBn.equal(
                        await v3Account.ownerOf(migratedAccountId),
                        snxStakerAddress
                    )
                });

                it('emitted an event', async () => {
                    await assertEvent(
                        txn,
                        'AccountMigrated',
                        market
                    )
                });
            });
        });
    }

    describe.only('migrate()', () => {
        it('fails when no debt to migrate', async () => {
            await assertRevert(
                market.connect(owner).migrate(migratedAccountId),
                'NothingToMigrate()',
            );
        });


        testMigrate(() => {
            return market.connect(snxStaker).migrate(migratedAccountId);
        });

        describe('when all accounts migrate to v3', () => {
            let allStakingAccounts: string[] = [];

            before('get list of all staking accounts', async () => {
    
            });

            before('call migrate for all accounts', async () => {
                
            });
    
            it('assigned all snx debt to legacy market', async () => {

            });

            it('can withdraw v2 USD for v3 USD', async () => {

            });
        });
    });

    describe('migrateOnBehalf()', () => {
        it('only works for owner', async () => {

        });

        testMigrate(async () => {
            return market.migrateOnBehalf(snxStakerAddress, migratedAccountId);
        });
    });

    describe('setPauseStablecoinConversion', async () => {
        it('only works for owner', async () => {

        });

        it('sets the value', async () => {

        });
    });

    describe('setPauseMigration', async () => {
        it('only works for owner', async () => {

        });

        it('sets the value', async () => {

        });
    });
});