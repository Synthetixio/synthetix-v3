const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('FundModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  describe('When creating the Fund', async () => {
    let FundModule, fundAddress, Fund;
    before('identify modules', async () => {
      FundModule = await ethers.getContractAt('FundModule', proxyAddress());
    });

    it('No Fund is deployed', async () => {
      const address = await FundModule.getFundAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the Module is initialized (Fund is created)', () => {
      let receipt;
      before('Initialize (Create a Fund token)', async () => {
        const tx = await FundModule.connect(owner).initializeFundModule();
        receipt = await tx.wait();
      });

      before('Identify newly created Fund', async () => {
        const event = findEvent({ receipt, eventName: 'FundCreated' });
        fundAddress = event.args.fundAddress;
        Fund = await ethers.getContractAt('Fund', fundAddress);
      });

      it('emmited an event', async () => {
        assert.notEqual(fundAddress, '0x0000000000000000000000000000000000000000');
      });

      it('is initialized', async () => {
        assert.equal(await FundModule.isFundModuleInitialized(), true);
      });

      it('gets the newly created address', async () => {
        const address = await FundModule.getFundAddress();
        assert.equal(address, fundAddress);
      });

      it('reads the Fund parameters', async () => {
        assert.equal(await Fund.name(), 'Synthetix Fund');
        assert.equal(await Fund.symbol(), 'synthethixFund');
      });

      it('gets the newly created satellite', async () => {
        const results = await FundModule.getFundModuleSatellites();
        assert.equal(results.length, 1);
        assert.equal(results[0].name, ethers.utils.formatBytes32String('synthethixFund'));
        assert.equal(results[0].contractName, ethers.utils.formatBytes32String('Fund'));
        assert.equal(results[0].deployedAddress, fundAddress);
      });

      describe('When attempting to create the Fund twice', () => {
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
          const factory = await ethers.getContractFactory('Fund');
          AnotherFund = await factory.deploy();
        });

        before('Upgrade to new implementation', async () => {
          const tx = await FundModule.connect(owner).upgradeFundImplementation(AnotherFund.address);

          await tx.wait();
        });

        it('is upgraded', async () => {
          NewFund = await ethers.getContractAt('Fund', fundAddress);
          assert.equal(AnotherFund.address, await NewFund.getImplementation());
        });

        it('reads the upgraded Fund parameters', async () => {
          assert.equal(await NewFund.name(), 'Synthetix Fund');
          assert.equal(await NewFund.symbol(), 'synthethixFund');
        });
      });
    });
  });
});
