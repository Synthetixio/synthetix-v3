const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('USDTokenModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1;

  before('identify signers', async () => {
    [owner, user1] = await ethers.getSigners();
  });

  describe('When creating the USD token', async () => {
    let USDTokenModule, snxTokenAddress, USD;
    before('identify modules', async () => {
      USDTokenModule = await ethers.getContractAt('USDTokenModule', proxyAddress());
    });

    it('No USD is deployed', async () => {
      const address = await USDTokenModule.getUSDTokenAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the Module is initialized (USD is created)', () => {
      let receipt;
      before('Initialize (Create a USD token)', async () => {
        const tx = await USDTokenModule.connect(owner).initializeUSDTokenModule();
        receipt = await tx.wait();
      });

      before('Identify newly created USD', async () => {
        const event = findEvent({ receipt, eventName: 'USDTokenCreated' });
        snxTokenAddress = event.args.snxAddress;
        USD = await ethers.getContractAt('usdToken', snxTokenAddress);
      });

      it('emmited an event', async () => {
        assert.notEqual(snxTokenAddress, '0x0000000000000000000000000000000000000000');
      });

      it('is initialized', async () => {
        assert.equal(await USDTokenModule.isUSDTokenModuleInitialized(), true);
      });

      it('gets the newly created address', async () => {
        const address = await USDTokenModule.getUSDTokenAddress();
        assert.equal(address, snxTokenAddress);
      });

      it('reads the USD parameters', async () => {
        assert.equal(await USD.name(), 'Synthetic USD Token v3');
        assert.equal(await USD.symbol(), 'USD');
        assert.equal(await USD.decimals(), 18);
      });

      it('gets the newly created satellite', async () => {
        const results = await USDTokenModule.getUSDTokenModuleSatellites();
        assert.equal(results.length, 1);
        assert.equal(results[0].name, ethers.utils.formatBytes32String('USD'));
        assert.equal(results[0].contractName, ethers.utils.formatBytes32String('USDToken'));
        assert.equal(results[0].deployedAddress, snxTokenAddress);
      });

      describe('When attempting to create the USD twice', () => {
        it('reverts', async () => {
          await assertRevert(
            USDTokenModule.connect(owner).initializeUSDTokenModule(),
            'AlreadyInitialized()'
          );
        });
      });

      describe('When attempting to upgrade to a new implementation', () => {
        let AnotherUSDToken, NewUSD;

        before('Deploy new implementation', async () => {
          const factory = await ethers.getContractFactory('USDTokenMock');
          AnotherUSDToken = await factory.deploy();
        });

        before('Upgrade to new implementation', async () => {
          const tx = await USDTokenModule.connect(owner).upgradeUSDImplementation(
            AnotherUSDToken.address
          );

          await tx.wait();
        });

        it('is upgraded', async () => {
          NewUSD = await ethers.getContractAt('USDTokenMock', snxTokenAddress);
          assert.equal(AnotherUSDToken.address, await NewUSD.getImplementation());
        });

        it('reads the upgraded USD parameters', async () => {
          assert.equal(await NewUSD.name(), 'Synthetic USD Token v3');
          assert.equal(await NewUSD.symbol(), 'USD');
          assert.equal(await NewUSD.decimals(), 18);
        });

        describe('New USD can mint', () => {
          const totalSupply = ethers.BigNumber.from('1000000');

          before('mint', async () => {
            const tx = await NewUSD.connect(user1)['mint(uint256)'](totalSupply);
            await tx.wait();
          });

          it('updates the total supply', async () => {
            assertBn.equal(await NewUSD.totalSupply(), totalSupply);
          });
        });
      });
    });
  });
});
