import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

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
  });

  // describe('#simulateUpgradeTo', function () {
  //   let NewImplementation: InitialModuleBundle;

  //   snapshotCheckpoint();

  //   before('create new implementation', async function () {
  //     const factory = await hre.ethers.getContractFactory('InitialModuleBundle', owner);
  //     NewImplementation = await factory.deploy();
  //   });

  //   it('reverts', async function () {
  //     await c.CoreProxy.simulateUpgradeTo(NewImplementation.address);
  //   });
  // });
});
