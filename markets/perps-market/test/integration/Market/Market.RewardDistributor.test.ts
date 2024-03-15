import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import hre from 'hardhat';
import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('PerpsMarket: Reward Distributor configuration test', () => {
  const { systems, signers, owner, synthMarkets, provider } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(10_000),
        sellPrice: bn(10_000),
      },
    ],
    perpsMarkets: [], // don't create a market in bootstrap
    traderAccountIds: [2, 3],
    collateralLiquidateRewardRatio: bn(0.42),
    skipRegisterDistributors: true,
  });

  let randomAccount: ethers.Signer;
  let perpsRewardDistributorV2: ethers.Contract;

  let synthBTCMarketId: ethers.BigNumber;

  before('identify actors', async () => {
    [, , , , randomAccount] = signers();
    synthBTCMarketId = synthMarkets()[0].marketId(); // 2
  });

  before('deploy upgraded distributor', async () => {
    const PerpsRewardDistributorV2 = await hre.ethers.getContractFactory(
      'MockPerpsRewardDistributorV2'
    );
    perpsRewardDistributorV2 = await PerpsRewardDistributorV2.deploy();
  });

  const restore = snapshotCheckpoint(provider);

  describe('initial configuration', () => {
    it('collateral liquidate reward ratio', async () => {
      assertBn.equal(await systems().PerpsMarket.getCollateralLiquidateRewardRatio(), bn(0.42));
    });

    it('reward distributor implementation is not zero address', async () => {
      assert.notEqual(
        await systems().PerpsMarket.getRewardDistributorImplementation(),
        ethers.constants.AddressZero
      );
    });

    it('reward distributor implementation', async () => {
      assert.equal(
        await systems().PerpsMarket.getRewardDistributorImplementation(),
        systems().PerpsRewardDistributor.address
      );
    });
  });

  describe('attempt to change configuration errors', () => {
    it('reverts setting collateral liquidate reward ratio as non-owner', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(randomAccount).setCollateralLiquidateRewardRatio(bn(0.1337)),
        'Unauthorized'
      );
    });

    it('reverts setting reward distributor implementation as non-owner', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(randomAccount)
          .setRewardDistributorImplementation(await perpsRewardDistributorV2.address),
        'Unauthorized'
      );
    });

    it('reverts setting reward distributor implementation with zero address', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .setRewardDistributorImplementation(ethers.constants.AddressZero),
        'ZeroAddress'
      );
    });

    it('reverts setting reward distributor implementation with a not-contract address', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .setRewardDistributorImplementation(await randomAccount.getAddress()),
        'NotAContract'
      );
    });

    it('reverts setting reward distributor implementation with a wrong contract', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .setRewardDistributorImplementation(systems().PerpsMarket.address),
        'InvalidDistributorContract'
      );
    });

    it('reverts registering a new distributor as non-owner', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(randomAccount)
          .registerDistributor(
            1,
            await randomAccount.getAddress(),
            ethers.constants.AddressZero,
            'clone 42',
            1,
            []
          ),
        'Unauthorized'
      );
    });

    it('reverts registering a new distributor with wrong data: collateralId', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            1,
            await randomAccount.getAddress(),
            ethers.constants.AddressZero,
            'clone 42',
            42,
            []
          ),
        'InvalidId("42")'
      );
    });

    it('reverts registering a new distributor with wrong data: poolDelegatedCollateralTypes empty', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            1,
            await randomAccount.getAddress(),
            ethers.constants.AddressZero,
            'clone 42',
            synthBTCMarketId,
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
            1,
            await randomAccount.getAddress(),
            ethers.constants.AddressZero,
            'clone 42',
            synthBTCMarketId,
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
            1,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            '',
            synthBTCMarketId,
            [await randomAccount.getAddress()]
          ),
        'ZeroAddress'
      );
    });

    it('reverts registering a new distributor with wrong data: wrong distributor address', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            1,
            await randomAccount.getAddress(),
            await randomAccount.getAddress(),
            '',
            synthBTCMarketId,
            [await randomAccount.getAddress()]
          ),
        'InvalidDistributorContract'
      );
    });
  });

  describe('update configuration', () => {
    describe('set reward distributor implementation', () => {
      let tx: ethers.ContractTransaction;
      before(restore);

      before('set reward distributor', async () => {
        tx = await systems()
          .PerpsMarket.connect(owner())
          .setRewardDistributorImplementation(perpsRewardDistributorV2.address);
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `RewardDistributorImplementationSet("${perpsRewardDistributorV2.address}")`,
          systems().PerpsMarket
        );
      });

      it('reward distributor implementation is set', async () => {
        assert.equal(
          await systems().PerpsMarket.getRewardDistributorImplementation(),
          perpsRewardDistributorV2.address
        );
      });
    });

    describe('set collateral liquidate reward ratio', () => {
      let tx: ethers.ContractTransaction;

      before(restore);

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
      let distributorAddress: string;
      before(restore);

      before('register distributor', async () => {
        distributorAddress = await systems()
          .PerpsMarket.connect(owner())
          .callStatic.registerDistributor(
            1,
            await randomAccount.getAddress(),
            ethers.constants.AddressZero,
            'clone 42',
            synthBTCMarketId,
            [await randomAccount.getAddress()]
          );
        tx = await systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(
            1,
            await randomAccount.getAddress(),
            ethers.constants.AddressZero,
            'clone 42',
            synthBTCMarketId,
            [await randomAccount.getAddress()]
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
          await randomAccount.getAddress()
        );
      });

      it('clone has the right information', async () => {
        const distributor = await hre.ethers.getContractAt(
          'MockPerpsRewardDistributor',
          distributorAddress
        );
        assert.equal(await distributor.version(), '1.0.0');
        assert.equal(await distributor.name(), 'clone 42');
      });

      describe('update distributor reusing the clone', () => {
        let previouCloneAddress: string;
        let newCloneAddress: string;

        before('get previous clone data', async () => {
          previouCloneAddress = (
            await systems().PerpsMarket.getRegisteredDistributor(synthBTCMarketId)
          ).distributor;
        });

        before('update config using previous distributor address', async () => {
          newCloneAddress = await systems()
            .PerpsMarket.connect(owner())
            .callStatic.registerDistributor(
              1,
              await randomAccount.getAddress(),
              previouCloneAddress,
              'clone 1337',
              synthBTCMarketId,
              [await randomAccount.getAddress(), await randomAccount.getAddress()]
            );

          await systems()
            .PerpsMarket.connect(owner())
            .registerDistributor(
              1,
              await randomAccount.getAddress(),
              previouCloneAddress,
              'clone 1337',
              synthBTCMarketId,
              [await randomAccount.getAddress(), await randomAccount.getAddress()]
            );
        });

        it('uses the same clone address', async () => {
          assert.equal(newCloneAddress, previouCloneAddress);
        });

        it('distributor is registered', async () => {
          const registeredDistributorData =
            await systems().PerpsMarket.getRegisteredDistributor(synthBTCMarketId);
          assert.equal(registeredDistributorData.distributor, newCloneAddress);

          assert.equal(registeredDistributorData.poolDelegatedCollateralTypes.length, 2);
          assert.equal(
            registeredDistributorData.poolDelegatedCollateralTypes[0],
            await randomAccount.getAddress()
          );
          assert.equal(
            registeredDistributorData.poolDelegatedCollateralTypes[1],
            await randomAccount.getAddress()
          );
        });

        it('clone has the right information', async () => {
          const distributor = await hre.ethers.getContractAt(
            'MockPerpsRewardDistributor',
            newCloneAddress
          );
          assert.equal(await distributor.version(), '1.0.0');
          assert.equal(await distributor.name(), 'clone 1337');
        });
      });

      describe('update distributor with a new clone', () => {
        let previouCloneAddress: string;
        let newCloneAddress: string;

        before('get previous clone data', async () => {
          previouCloneAddress = (
            await systems().PerpsMarket.getRegisteredDistributor(synthBTCMarketId)
          ).distributor;
        });

        before('update config using previous distributor address', async () => {
          newCloneAddress = await systems()
            .PerpsMarket.connect(owner())
            .callStatic.registerDistributor(
              1,
              await randomAccount.getAddress(),
              ethers.constants.AddressZero,
              'clone updated',
              synthBTCMarketId,
              [await randomAccount.getAddress(), await randomAccount.getAddress()]
            );

          await systems()
            .PerpsMarket.connect(owner())
            .registerDistributor(
              1,
              await randomAccount.getAddress(),
              ethers.constants.AddressZero,
              'clone updated',
              synthBTCMarketId,
              [await randomAccount.getAddress(), await randomAccount.getAddress()]
            );
        });

        it('uses a different clone', async () => {
          assert.notEqual(newCloneAddress, previouCloneAddress);
        });

        it('distributor is registered', async () => {
          const registeredDistributorData =
            await systems().PerpsMarket.getRegisteredDistributor(synthBTCMarketId);
          assert.equal(registeredDistributorData.distributor, newCloneAddress);

          assert.equal(registeredDistributorData.poolDelegatedCollateralTypes.length, 2);
          assert.equal(
            registeredDistributorData.poolDelegatedCollateralTypes[0],
            await randomAccount.getAddress()
          );
          assert.equal(
            registeredDistributorData.poolDelegatedCollateralTypes[1],
            await randomAccount.getAddress()
          );
        });

        it('clone has the right information', async () => {
          const distributor = await hre.ethers.getContractAt(
            'MockPerpsRewardDistributor',
            newCloneAddress
          );
          assert.equal(await distributor.version(), '1.0.0');
          assert.equal(await distributor.name(), 'clone updated');
        });
      });

      describe('updates the implementation and then clones it', () => {
        let previouCloneAddress: string;
        let newCloneAddress: string;

        before('get previous clone data', async () => {
          previouCloneAddress = (
            await systems().PerpsMarket.getRegisteredDistributor(synthBTCMarketId)
          ).distributor;
        });

        before('set new reward distributor', async () => {
          tx = await systems()
            .PerpsMarket.connect(owner())
            .setRewardDistributorImplementation(perpsRewardDistributorV2.address);
        });

        before('update config to just replace the clone', async () => {
          newCloneAddress = await systems()
            .PerpsMarket.connect(owner())
            .callStatic.registerDistributor(
              1,
              await randomAccount.getAddress(),
              ethers.constants.AddressZero,
              'clone updated',
              synthBTCMarketId,
              [await randomAccount.getAddress(), await randomAccount.getAddress()]
            );

          await systems()
            .PerpsMarket.connect(owner())
            .registerDistributor(
              1,
              await randomAccount.getAddress(),
              ethers.constants.AddressZero,
              'clone updated',
              synthBTCMarketId,
              [await randomAccount.getAddress(), await randomAccount.getAddress()]
            );
        });

        it('uses a different clone', async () => {
          assert.notEqual(newCloneAddress, previouCloneAddress);
        });

        it('distributor is registered', async () => {
          const registeredDistributorData =
            await systems().PerpsMarket.getRegisteredDistributor(synthBTCMarketId);
          assert.equal(registeredDistributorData.distributor, newCloneAddress);

          assert.equal(registeredDistributorData.poolDelegatedCollateralTypes.length, 2);
          assert.equal(
            registeredDistributorData.poolDelegatedCollateralTypes[0],
            await randomAccount.getAddress()
          );
          assert.equal(
            registeredDistributorData.poolDelegatedCollateralTypes[1],
            await randomAccount.getAddress()
          );
        });

        it('clone has the right information', async () => {
          const distributor = await hre.ethers.getContractAt(
            'MockPerpsRewardDistributor',
            newCloneAddress
          );
          assert.equal(await distributor.version(), '2.0.0');
          assert.equal(await distributor.name(), 'clone updated');
        });
      });
    });
  });
});
