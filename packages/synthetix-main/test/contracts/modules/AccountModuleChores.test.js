const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('AccountModule - Chores', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  describe('When creating the AccountToken', async () => {
    let AccountModule, accountTokenAddress, AccountToken;
    before('identify modules', async () => {
      AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
    });

    it('No AccountToken is deployed', async () => {
      const address = await AccountModule.getAccountAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the Module is initialized (AccountToken is created)', () => {
      let receipt;
      before('Initialize (Create a AccountToken token)', async () => {
        const tx = await AccountModule.connect(owner).initializeAccountModule();
        receipt = await tx.wait();
      });

      before('Identify newly created AccountToken', async () => {
        const event = findEvent({ receipt, eventName: 'AccountCreated' });
        accountTokenAddress = event.args.accountAddress;
        AccountToken = await ethers.getContractAt('AccountToken', accountTokenAddress);
      });

      it('emmited an event', async () => {
        assert.notEqual(accountTokenAddress, '0x0000000000000000000000000000000000000000');
      });

      it('is initialized', async () => {
        assert.equal(await AccountModule.isAccountModuleInitialized(), true);
      });

      it('gets the newly created address', async () => {
        const address = await AccountModule.getAccountAddress();
        assert.equal(address, accountTokenAddress);
      });

      it('reads the AccountToken parameters', async () => {
        assert.equal(await AccountToken.name(), 'Synthetix Account');
        assert.equal(await AccountToken.symbol(), 'synthethixAccount');
      });

      it('gets the newly created satellite', async () => {
        const results = await AccountModule.getAccountModuleSatellites();
        assert.equal(results.length, 1);
        assert.equal(results[0].name, ethers.utils.formatBytes32String('synthethixAccount'));
        assert.equal(results[0].contractName, ethers.utils.formatBytes32String('AccountToken'));
        assert.equal(results[0].deployedAddress, accountTokenAddress);
      });

      describe('When attempting to create the AccountToken twice', () => {
        it('reverts', async () => {
          await assertRevert(
            AccountModule.connect(owner).initializeAccountModule(),
            'AlreadyInitialized()'
          );
        });
      });

      describe('When attempting to upgrade to a new implementation', () => {
        let AnotherAccount, NewAccount;

        before('Deploy new implementation', async () => {
          const factory = await ethers.getContractFactory('AccountToken');
          AnotherAccount = await factory.deploy();
        });

        before('Upgrade to new implementation', async () => {
          const tx = await AccountModule.connect(owner).upgradeAccountImplementation(
            AnotherAccount.address
          );

          await tx.wait();
        });

        it('is upgraded', async () => {
          NewAccount = await ethers.getContractAt('AccountToken', accountTokenAddress);
          assert.equal(AnotherAccount.address, await NewAccount.getImplementation());
        });

        it('reads the upgraded AccountToken parameters', async () => {
          assert.equal(await NewAccount.name(), 'Synthetix Account');
          assert.equal(await NewAccount.symbol(), 'synthethixAccount');
        });
      });
    });
  });
});
