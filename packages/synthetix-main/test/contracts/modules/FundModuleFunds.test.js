const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('FundModule - Funds Admin', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, fundAdmin, user1, user2;

  let CollateralModule, Collateral, CollateralPriceFeed;
  let AccountModule, AccountToken, accountTokenAddress;
  let FundModule, FundToken, fundTokenAddress;

  before('identify signers', async () => {
    [owner, fundAdmin, user1, user2] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    FundModule = await ethers.getContractAt('FundModule', proxyAddress());

    CollateralModule = await ethers.getContractAt('CollateralModule', proxyAddress());
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
    await (await AccountModule.connect(owner).initializeAccountModule()).wait();
    accountTokenAddress = await AccountModule.getAccountAddress();

    AccountToken = await ethers.getContractAt('AccountToken', accountTokenAddress);
  });

  before('Initialize tokens and modules', async () => {
    await (await FundModule.connect(owner).initializeFundModule()).wait();
    fundTokenAddress = await FundModule.getFundTokenAddress();

    FundToken = await ethers.getContractAt('FundToken', fundTokenAddress);
  });

  before('add one collateral', async () => {
    let factory;

    factory = await ethers.getContractFactory('CollateralMock');
    Collateral = await factory.deploy();

    await (await Collateral.connect(owner).initialize('Synthetix Token', 'SNX', 18)).wait();

    factory = await ethers.getContractFactory('CollateralPriceFeedMock');
    CollateralPriceFeed = await factory.deploy();

    await (await CollateralPriceFeed.connect(owner).setCurrentPrice(1)).wait();

    await (
      await CollateralModule.connect(owner).addCollateralType(
        Collateral.address,
        CollateralPriceFeed.address,
        400,
        200
      )
    ).wait();
  });

  before('mint some account tokens', async () => {
    await (await AccountModule.connect(user1).mintAccount(1)).wait();
    await (await AccountModule.connect(user2).mintAccount(2)).wait();
  });

  before('mint some collateral to the user', async () => {
    await (await Collateral.mint(user1.address, 1000)).wait();
    await (await Collateral.mint(user2.address, 1000)).wait();
  });

  before('approve AccountModule to operate with the user collateral', async () => {
    await (
      await Collateral.connect(user1).approve(AccountModule.address, ethers.constants.MaxUint256)
    ).wait();
    await (
      await Collateral.connect(user2).approve(AccountModule.address, ethers.constants.MaxUint256)
    ).wait();
  });

  before('stake some collateral', async () => {
    await (await CollateralModule.connect(user1).stake(1, Collateral.address, 100)).wait();
  });

  before('mint a fund token', async () => {
    await (await FundModule.connect(user1).mintFund(1, fundAdmin.address)).wait();
  });

  it('fund is created', async () => {
    assert.equal(await FundToken.ownerOf(1), fundAdmin.address);
    assertBn.equal(await FundToken.balanceOf(fundAdmin.address), 1);
  });

  describe('When setting up the Fund positions', async () => {
    describe('when attempting to set the positions of a non existent fund', async () => {
      it('reverts', async () => {
        await assertRevert(
          FundModule.connect(fundAdmin).setFundPosition(2, [1], [1]),
          'TokenDoesNotExist(2)'
        );
      });
    });

    describe('when a regular user attempts to set the positions', async () => {
      it('reverts', async () => {
        await assertRevert(
          FundModule.connect(user1).setFundPosition(1, [1], [1]),
          `Unauthorized("${user1.address}")`
        );
      });
    });

    describe('when attempting to set the positions with not matching number of positions', async () => {
      it('reverts with more weights than markets', async () => {
        await assertRevert(
          FundModule.connect(fundAdmin).setFundPosition(1, [1], [1, 2]),
          'InvalidParameters()'
        );
      });

      it('reverts with more markets than weights', async () => {
        await assertRevert(
          FundModule.connect(fundAdmin).setFundPosition(1, [1, 2], [1]),
          'InvalidParameters()'
        );
      });
    });

    describe('when adjusting a fund positions', async () => {
      let receipt;

      before('adjust fund positions', async () => {
        const tx = await FundModule.connect(fundAdmin).setFundPosition(1, [1, 2], [1, 1]);
        receipt = await tx.wait();
      });

      it('emmited an event', async () => {
        const event = findEvent({ receipt, eventName: 'FundPositionSet' });

        assert.equal(event.args.executedBy, fundAdmin.address);
        assertBn.equal(event.args.fundId, 1);
        assert.equal(event.args.markets.length, 2);
        assert.equal(event.args.weights.length, 2);
        assertBn.equal(event.args.markets[0], 1);
        assertBn.equal(event.args.markets[1], 2);
        assertBn.equal(event.args.weights[0], 1);
        assertBn.equal(event.args.weights[1], 1);
      });

      it('is created', async () => {
        let markets, weights;
        [markets, weights] = await FundModule.getFundPosition(1);
        assert.equal(markets.length, 2);
        assert.equal(weights.length, 2);
        assertBn.equal(markets[0], 1);
        assertBn.equal(markets[1], 2);
        assertBn.equal(weights[0], 1);
        assertBn.equal(weights[1], 1);
      });
    });
  });
});
