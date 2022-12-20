const { ethers } = hre;
const assert = require('assert/strict');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-utils/utils/ethers/events');

describe.only('DecayToken', () => {
  let token;

  let user1, user2;

  before('identify signers', async () => {
    [user1, user2] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('DecayTokenMock');
    token = await factory.deploy();
    let tx = await token.initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();
    //1% decay per year
    tx = await token.setInterestRate(1);
    await tx.wait();
  });

  describe('When attempting to initialize it again', () => {
    it('reverts', async () => {
      await assertRevert(
        token.initialize('Synthetix Network Token Updated', 'snx', 18),
        'AlreadyInitialized()'
      );
    });
  });

  describe('Before minting any tokens', () => {
    it('the total supply is 0', async () => {
      assertBn.equal(await token.totalSupply(), 0);
    });

    it('the constructor arguments are set correctly', async () => {
      assert.equal(await token.name(), 'Synthetix Network Token');
      assert.equal(await token.symbol(), 'snx');
      assertBn.equal(await token.decimals(), 18);
      assertBn.equal(await token.interestRate(), 1);
    });
  });
});
