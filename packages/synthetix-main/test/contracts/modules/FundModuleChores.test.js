const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('FundModule Chores', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  describe('When creating the FundToken', async () => {
    let FundModule, fundTokenAddress, FundToken;
    before('identify modules', async () => {
      FundModule = await ethers.getContractAt('FundModule', proxyAddress());
    });

    it('No FundToken is deployed', async () => {
      const address = await FundModule.getFundTokenAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the Module is initialized (Fund is created)', () => {
      let receipt;
      before('Initialize (Create a Fund token)', async () => {
        const tx = await FundModule.connect(owner).initializeFundModule();
        receipt = await tx.wait();
      });

      before('Identify newly created FundToken', async () => {
        const event = findEvent({ receipt, eventName: 'FundCreated' });
        fundTokenAddress = event.args.fundAddress;
        FundToken = await ethers.getContractAt('FundToken', fundTokenAddress);
      });

      it('emmited an event', async () => {
        assert.notEqual(fundTokenAddress, '0x0000000000000000000000000000000000000000');
      });

      it('is initialized', async () => {
        assert.equal(await FundModule.isFundModuleInitialized(), true);
      });

      it('gets the newly created address', async () => {
        const address = await FundModule.getFundTokenAddress();
        assert.equal(address, fundTokenAddress);
      });

      it('reads the FundToken parameters', async () => {
        assert.equal(await FundToken.name(), 'Synthetix FundToken');
        assert.equal(await FundToken.symbol(), 'synthethixFundToken');
      });

      it('gets the newly created satellite', async () => {
        const results = await FundModule.getFundModuleSatellites();
        assert.equal(results.length, 1);
        assert.equal(results[0].name, ethers.utils.formatBytes32String('synthethixFundToken'));
        assert.equal(results[0].contractName, ethers.utils.formatBytes32String('FundToken'));
        assert.equal(results[0].deployedAddress, fundTokenAddress);
      });

      describe('When attempting to initialize the FundModule twice', () => {
        it('reverts', async () => {
          await assertRevert(
            FundModule.connect(owner).initializeFundModule(),
            'AlreadyInitialized()'
          );
        });
      });

      describe('When attempting to upgrade to a new implementation', () => {
        let AnotherFund, NewFund;

        before('Deploy new implementation', async () => {
          const factory = await ethers.getContractFactory('FundToken');
          AnotherFund = await factory.deploy();
        });

        before('Upgrade to new implementation', async () => {
          const tx = await FundModule.connect(owner).upgradeFundTokenImplementation(
            AnotherFund.address
          );

          await tx.wait();
        });

        it('is upgraded', async () => {
          NewFund = await ethers.getContractAt('FundToken', fundTokenAddress);
          assert.equal(AnotherFund.address, await NewFund.getImplementation());
        });

        it('reads the upgraded AccountToken parameters', async () => {
          assert.equal(await NewFund.name(), 'Synthetix FundToken');
          assert.equal(await NewFund.symbol(), 'synthethixFundToken');
        });
      });
    });
  });
});
