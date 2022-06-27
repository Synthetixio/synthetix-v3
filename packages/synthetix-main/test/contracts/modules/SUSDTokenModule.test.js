const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('SUSDTokenModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1;

  before('identify signers', async () => {
    [owner, user1] = await ethers.getSigners();
  });

  describe('When creating the SUSD token', async () => {
    let SUSDTokenModule, snxTokenAddress, SUSD;
    before('identify modules', async () => {
      SUSDTokenModule = await ethers.getContractAt('SUSDTokenModule', proxyAddress());
    });

    it('No SUSD is deployed', async () => {
      const address = await SUSDTokenModule.getSUSDTokenAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the Module is initialized (SUSD is created)', () => {
      let receipt;
      before('Initialize (Create a SUSD token)', async () => {
        const tx = await SUSDTokenModule.connect(owner).initializeSUSDTokenModule();
        receipt = await tx.wait();
      });

      before('Identify newly created SUSD', async () => {
        const event = findEvent({ receipt, eventName: 'SUSDTokenCreated' });
        snxTokenAddress = event.args.snxAddress;
        SUSD = await ethers.getContractAt('SUSDToken', snxTokenAddress);
      });

      it('emmited an event', async () => {
        assert.notEqual(snxTokenAddress, '0x0000000000000000000000000000000000000000');
      });

      it('is initialized', async () => {
        assert.equal(await SUSDTokenModule.isSUSDTokenModuleInitialized(), true);
      });

      it('gets the newly created address', async () => {
        const address = await SUSDTokenModule.getSUSDTokenAddress();
        assert.equal(address, snxTokenAddress);
      });

      it('reads the SUSD parameters', async () => {
        assert.equal(await SUSD.name(), 'Synthetic USD Token v3');
        assert.equal(await SUSD.symbol(), 'sUSD');
        assert.equal(await SUSD.decimals(), 18);
      });

      it('gets the newly created satellite', async () => {
        const results = await SUSDTokenModule.getSUSDTokenModuleSatellites();
        assert.equal(results.length, 1);
        assert.equal(results[0].name, ethers.utils.formatBytes32String('sUSD'));
        assert.equal(results[0].contractName, ethers.utils.formatBytes32String('SUSDToken'));
        assert.equal(results[0].deployedAddress, snxTokenAddress);
      });

      describe('When attempting to create the SUSD twice', () => {
        it('reverts', async () => {
          await assertRevert(
            SUSDTokenModule.connect(owner).initializeSUSDTokenModule(),
            'AlreadyInitialized()'
          );
        });
      });

      describe('When attempting to upgrade to a new implementation', () => {
        let AnotherSUSDToken, NewSUSD;

        before('Deploy new implementation', async () => {
          const factory = await ethers.getContractFactory('SUSDTokenMock');
          AnotherSUSDToken = await factory.deploy();
        });

        before('Upgrade to new implementation', async () => {
          const tx = await SUSDTokenModule.connect(owner).upgradeSUSDImplementation(
            AnotherSUSDToken.address
          );

          await tx.wait();
        });

        it('is upgraded', async () => {
          NewSUSD = await ethers.getContractAt('SUSDTokenMock', snxTokenAddress);
          assert.equal(AnotherSUSDToken.address, await NewSUSD.getImplementation());
        });

        it('reads the upgraded SUSD parameters', async () => {
          assert.equal(await NewSUSD.name(), 'Synthetic USD Token v3');
          assert.equal(await NewSUSD.symbol(), 'sUSD');
          assert.equal(await NewSUSD.decimals(), 18);
        });

        describe('New SUSD can mint', () => {
          const totalSupply = ethers.BigNumber.from('1000000');

          before('mint', async () => {
            const tx = await NewSUSD.connect(user1)['mint(uint256)'](totalSupply);
            await tx.wait();
          });

          it('updates the total supply', async () => {
            assertBn.equal(await NewSUSD.totalSupply(), totalSupply);
          });
        });
      });
    });
  });
});
