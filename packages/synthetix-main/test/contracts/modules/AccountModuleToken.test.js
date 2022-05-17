const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { isTypedArray } = require('util/types');

describe('AccountModule - AccountToken', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1, user2;

  let AccountModule, accountTokenAddress, AccountToken;

  before('identify signers', async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
  });

  before('Initialize (Create a AccountToken token)', async () => {
    await (await AccountModule.connect(owner).initializeAccountModule()).wait();
    accountTokenAddress = await AccountModule.getAccountAddress();

    AccountToken = await ethers.getContractAt('AccountToken', accountTokenAddress);
  });

  describe('when attempting to mint an account token from the satellite', async () => {
    it('reverts', async () => {
      await assertRevert(
        AccountToken.connect(user1).mint(user1.address, 1),
        `Unauthorized("${user1.address}")`
      );
    });
  });
  describe('When minting an AccountToken', async () => {
    before('mint an accoun token', async () => {});

    it('', async () => {});

    describe('', async () => {});
  });
});
