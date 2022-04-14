const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('AccountModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1;

  before('identify signers', async () => {
    [owner, user1] = await ethers.getSigners();
  });

  describe('When creating the Account', async () => {
    let AccountModule, accountAddress, Account;
    before('identify modules', async () => {
      AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
    });

    it('No Account is deployed', async () => {
      const address = await AccountModule.getAccountAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the Module is initialized (Account is created)', () => {
      let receipt;
      before('Initialize (Create a Account token)', async () => {
        const tx = await AccountModule.connect(owner).initializeAccountModule();
        receipt = await tx.wait();
      });

      before('Identify newly created Account', async () => {
        const event = findEvent({ receipt, eventName: 'AccountCreated' });
        accountAddress = event.args.accountAddress;
        Account = await ethers.getContractAt('Account', accountAddress);
      });

      it('emmited an event', async () => {
        assert.notEqual(accountAddress, '0x0000000000000000000000000000000000000000');
      });

      it('is initialized', async () => {
        assert.equal(await AccountModule.isAccountModuleInitialized(), true);
      });

      it('gets the newly created address', async () => {
        const address = await AccountModule.getAccountAddress();
        assert.equal(address, accountAddress);
      });

      it('reads the Account parameters', async () => {
        assert.equal(await Account.name(), 'Synthetix Account');
        assert.equal(await Account.symbol(), 'synthethixAccount');
      });

      it('gets the newly created satellite', async () => {
        const results = await AccountModule.getAccountModuleSatellites();
        assert.equal(results.length, 1);
        assert.equal(results[0].name, ethers.utils.formatBytes32String('synthethixAccount'));
        assert.equal(results[0].contractName, ethers.utils.formatBytes32String('Account'));
        assert.equal(results[0].deployedAddress, accountAddress);
      });

      describe('When attempting to create the Account twice', () => {
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
          const factory = await ethers.getContractFactory('Account');
          AnotherAccount = await factory.deploy();
        });

        before('Upgrade to new implementation', async () => {
          const tx = await AccountModule.connect(owner).upgradeAccountImplementation(
            AnotherAccount.address
          );

          await tx.wait();
        });

        it('is upgraded', async () => {
          NewAccount = await ethers.getContractAt('Account', accountAddress);
          assert.equal(AnotherAccount.address, await NewAccount.getImplementation());
        });

        it('reads the upgraded Account parameters', async () => {
          assert.equal(await NewAccount.name(), 'Synthetix Account');
          assert.equal(await NewAccount.symbol(), 'synthethixAccount');
        });
      });
    });
  });
});
