import assert from 'node:assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../bootstrap';
import { InitialModuleBundle } from '../generated/typechain';

describe('UpgradeProposalModule', function () {
  const { c, getSigners, snapshotCheckpoint } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  describe('#upgradeTo', function () {
    it('reverts when called by not the owner', async function () {
      await assertRevert(
        c.CoreProxy.connect(user).upgradeTo(ethers.constants.AddressZero),
        'Unauthorized'
      );
    });

    it('reverts when using Zero Address', async function () {
      await assertRevert(c.CoreProxy.upgradeTo(ethers.constants.AddressZero), 'ZeroAddress');
    });

    it('reverts when using something that is not a contract', async function () {
      await assertRevert(c.CoreProxy.upgradeTo(await user.getAddress()), 'NotAContract');
    });

    it('reverts when proposing same implementation', async function () {
      const current = await c.CoreProxy.getImplementation();
      await assertRevert(c.CoreProxy.upgradeTo(current), 'NoChange');
    });

    describe('when proposing a valid implementation', function () {
      let NewImplementation: InitialModuleBundle;

      snapshotCheckpoint();

      before('create new implementation', async function () {
        const factory = await hre.ethers.getContractFactory('InitialModuleBundle', owner);
        NewImplementation = await factory.deploy();
      });

      before('call to upgradeTo', async function () {
        await c.CoreProxy.upgradeTo(NewImplementation.address);
      });

      it('saves the value', async function () {
        assert.equal(await c.CoreProxy.getProposedImplementation(), NewImplementation.address);
      });
    });
  });
});
