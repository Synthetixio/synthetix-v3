import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { FeatureFlagModule, SampleFeatureFlagModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('FeatureFlagModule', function () {
  const { getContract, getSigners } = bootstrap({ implementation: 'FeatureFlagModuleRouter' });

  let FeatureFlagModule: FeatureFlagModule;
  let SampleFeatureFlagModule: SampleFeatureFlagModule;
  let permissionedUser: ethers.Signer;
  let user: ethers.Signer;

  const FEATURE_FLAG_NAME = ethers.utils.formatBytes32String('SAMPLE_FEATURE');

  before('identify signers', function () {
    [, permissionedUser, user] = getSigners();
  });

  before('identify modules', function () {
    FeatureFlagModule = getContract('FeatureFlagModule');
    SampleFeatureFlagModule = getContract('SampleFeatureFlagModule');
  });

  describe('when a feature flag is enabled', async function () {
    let addAddressTx: ethers.ContractTransaction;

    before('setup permissioned user for feature flag', async function () {
      addAddressTx = await FeatureFlagModule.addToFeatureFlagAllowlist(
        FEATURE_FLAG_NAME,
        await permissionedUser.getAddress()
      );
    });

    it('does not allow non-owners to set feature flags', async function () {
      await assertRevert(
        FeatureFlagModule.connect(user).setFeatureFlagAllowAll(FEATURE_FLAG_NAME, true),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    it('does not allow non-owners to set feature flag addresses', async function () {
      await assertRevert(
        FeatureFlagModule.connect(user).addToFeatureFlagAllowlist(
          FEATURE_FLAG_NAME,
          await permissionedUser.getAddress()
        ),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    it('emits event for adding address', async function () {
      await assertEvent(
        addAddressTx,
        `FeatureFlagAllowlistAdded("${FEATURE_FLAG_NAME}", "${await permissionedUser.getAddress()}")`,
        FeatureFlagModule
      );
    });
  });

  describe('call function behind feature flag', async function () {
    it('reverts when user does not have permission', async function () {
      await assertRevert(
        SampleFeatureFlagModule.connect(user).setFeatureFlaggedValue(15),
        'FeatureUnavailable'
      );
    });

    it('allows permissioned user to call function', async function () {
      await SampleFeatureFlagModule.connect(permissionedUser).setFeatureFlaggedValue(15);
      assertBn.equal(await SampleFeatureFlagModule.getFeatureFlaggedValue(), 15);
    });
  });

  it('does not allow non-owners to remove feature flag addresses', async function () {
    await assertRevert(
      FeatureFlagModule.connect(user).removeFromFeatureFlagAllowlist(
        FEATURE_FLAG_NAME,
        await permissionedUser.getAddress()
      ),
      `Unauthorized("${await user.getAddress()}")`
    );

    await assertRevert(
      FeatureFlagModule.connect(permissionedUser).removeFromFeatureFlagAllowlist(
        FEATURE_FLAG_NAME,
        await permissionedUser.getAddress()
      ),
      `Unauthorized("${await permissionedUser.getAddress()}")`
    );
  });

  describe('remove permissioned user from feature flag', async function () {
    let removeAddressTx: ethers.ContractTransaction;

    before('remove user', async function () {
      removeAddressTx = await FeatureFlagModule.removeFromFeatureFlagAllowlist(
        FEATURE_FLAG_NAME,
        await permissionedUser.getAddress()
      );
    });

    it('emits event', async function () {
      await assertEvent(
        removeAddressTx,
        `FeatureFlagAllowlistRemoved("${FEATURE_FLAG_NAME}", "${await permissionedUser.getAddress()}")`,
        FeatureFlagModule
      );
    });

    it('does not allow removed permissionedUser to set value', async function () {
      await assertRevert(
        SampleFeatureFlagModule.connect(permissionedUser).setFeatureFlaggedValue(25),
        'FeatureUnavailable'
      );
    });
  });

  describe('enable feature for all', async function () {
    let setupTx: ethers.ContractTransaction;

    before('allow all', async function () {
      setupTx = await FeatureFlagModule.setFeatureFlagAllowAll(FEATURE_FLAG_NAME, true);
    });

    it('emits event', async function () {
      await assertEvent(
        setupTx,
        `FeatureFlagAllowAllSet("${FEATURE_FLAG_NAME}", true)`,
        FeatureFlagModule
      );
    });

    it('reverts when feature flag is disabled', async function () {
      await SampleFeatureFlagModule.connect(user).setFeatureFlaggedValue(25);
      assertBn.equal(await SampleFeatureFlagModule.getFeatureFlaggedValue(), 25);
    });
  });
});
