const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');

describe('MarketManager', function () {
  const { proxyAddress } = bootstrap(initializer);

  const One = ethers.utils.parseEther('1');
  const Hundred = ethers.utils.parseEther('100');

  let owner, user1, user2;

  let MarketManagerModule, USDTokenModule, USDToken;
  let Market1;
  let market1id;

  before('identify signers', async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    USDTokenModule = await ethers.getContractAt('USDTokenModule', proxyAddress());
    await (await USDTokenModule.connect(owner).initializeUSDTokenModule()).wait();
    const usdTokenAddress = await USDTokenModule.getUSDTokenAddress();

    // Use USDTokenMock to manually mint USD
    const factory = await ethers.getContractFactory('USDTokenMock');
    const USDTokenMock = await factory.deploy();
    await (
      await USDTokenModule.connect(owner).upgradeUSDImplementation(USDTokenMock.address)
    ).wait();
    USDToken = await ethers.getContractAt('USDTokenMock', usdTokenAddress);

    MarketManagerModule = await ethers.getContractAt('MarketManagerModule', proxyAddress());
  });

  before('create dummy markets', async () => {
    Market1 = await (await ethers.getContractFactory('MarketMock')).deploy();
  });

  describe('when a market is registered', async () => {
    let receipt;

    before('register a market', async () => {
      receipt = await (await MarketManagerModule.registerMarket(Market1.address)).wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'MarketRegistered' });
      assert(event.args.market, Market1.address);
      market1id = event.args.marketId;
      await (await Market1.connect(owner).initialize(proxyAddress(), market1id, One)).wait();
      assert(market1id, 1);
    });

    it('liquidity is zero', async () => {
      assertBn.equal(await MarketManagerModule.liquidity(market1id), 0);
    });

    it('totalBalance is zero', async () => {
      assertBn.equal(await MarketManagerModule.totalBalance(market1id), 0);
    });

    describe('when attempting to register a market again', async () => {
      it('reverts', async () => {
        await assertRevert(
          MarketManagerModule.registerMarket(Market1.address),
          `MarketAlreadyRegistered("${Market1.address}")`
        );
      });
    });

    describe('before the market received liquidity', async () => {
      describe('when attempting to sell synths', async () => {
        it('reverts', async () => {
          await assertRevert(
            Market1.connect(user1).sellSynth(Hundred),
            `NotEnoughLiquidity(${market1id}, ${Hundred.toString()})`
          );
        });
      });

      describe('when someone buys some synths', async () => {
        let liquidityBefore;
        before('mint USD to use market', async () => {
          liquidityBefore = await MarketManagerModule.liquidity(market1id);
          await (await USDToken.connect(user1)['mint(uint256)'](Hundred)).wait();
          await (await USDToken.connect(user1).approve(Market1.address, Hundred)).wait();
        });

        before('user1 buys some synth (deposit USD)', async () => {
          await (await Market1.connect(user1).buySynth(Hundred)).wait();
        });

        it('issuance increased liquidity', async () => {
          const liquidity = await MarketManagerModule.liquidity(market1id);
          assertBn.equal(liquidity, liquidityBefore.add(Hundred));
        });
      });
    });
  });
});
