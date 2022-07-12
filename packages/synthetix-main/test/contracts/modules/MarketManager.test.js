const { ethers } = hre;
const assert = require('assert/strict');
// const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('MarketManager', function () {
  const { proxyAddress } = bootstrap(initializer);

  // let owner, fundAdmin, user1, user2;

  // let AccountModule, CollateralModule, Collateral, AggregatorV3Mock;
  let MarketManagerModule;
  let Market1;
  let market1id;

  before('identify signers', async () => {
    // [owner, fundAdmin, user1, user2] = await ethers.getSigners();
  });

  before('identify modules', async () => {
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
      assert(market1id, 1);
    });

    describe('when attempting to register a market again', async () => {
      it('reverts', async () => {
        await assertRevert(
          MarketManagerModule.registerMarket(Market1.address),
          `MarketAlreadyRegistered("${Market1.address}")`
        );
      });
    });
  });
});
