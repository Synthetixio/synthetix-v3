const { ethers } = hre;
const { ethers: Ethers } = require('ethers');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { default: assertEvent } = require('@synthetixio/core-utils/utils/assertions/assert-event');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/hardhat-router/dist/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('FeatureFlagModule', () => {
  const { proxyAddress } = bootstrap(initializer, {
    modules: '.*(FeatureFlagModule|SampleFeatureFlagModule|Owner|Upgrade).*',
  });

  let FeatureFlagModule, SampleFeatureFlagModule;
  let owner, permissionedUser, user;

  const FEATURE_FLAG_NAME = Ethers.utils.formatBytes32String('SAMPLE_FEATURE');

  before('identify signers', async () => {
    [owner, permissionedUser, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    FeatureFlagModule = await ethers.getContractAt('FeatureFlagModule', proxyAddress());
    SampleFeatureFlagModule = await ethers.getContractAt('SampleFeatureFlagModule', proxyAddress());
  });

  it('does not allow non-owners to set feature flags', async () => {
    await assertRevert(
      FeatureFlagModule.connect(user).setFeatureFlag(FEATURE_FLAG_NAME, true),
      'Unauthorized'
    );
  });

  let setupTx;
  before('setup feature flag', async () => {
    setupTx = await FeatureFlagModule.connect(owner).setFeatureFlag(FEATURE_FLAG_NAME, true);
    // .to.emit(FeatureFlagModule, 'FeatureFlagSet')
    // .withArgs(FEATURE_FLAG_NAME, true);
  });

  it('emits event', async () => {
    await assertEvent(setupTx, `FeatureFlagSet("${FEATURE_FLAG_NAME}", true)`, FeatureFlagModule);
  });

  it('does not allow non-owners to set feature flag addresses', async () => {
    await assertRevert(
      FeatureFlagModule.connect(user).addToFeatureFlag(FEATURE_FLAG_NAME, permissionedUser.address),
      'Unauthorized'
    );
  });

  let addAddressTx;
  before('setup permissioned user for feature flag', async () => {
    addAddressTx = await FeatureFlagModule.connect(owner).addToFeatureFlag(
      FEATURE_FLAG_NAME,
      permissionedUser.address
    );
  });

  it('emits event for adding address', async () => {
    await assertEvent(
      addAddressTx,
      `FeatureFlagAddressAdded("${FEATURE_FLAG_NAME}", "${permissionedUser.address}")`,
      FeatureFlagModule
    );
  });

  describe('call function behind feature flag', async () => {
    it('reverts when user does not have permission', async () => {
      await assertRevert(
        SampleFeatureFlagModule.connect(user).setFeatureFlaggedValue(15),
        'Unauthorized'
      );
    });

    it('allows permissioned user to call function', async () => {
      await SampleFeatureFlagModule.connect(permissionedUser).setFeatureFlaggedValue(15);
      assertBn.equal(await SampleFeatureFlagModule.getFeatureFlaggedValue(), 15);
    });
  });

  it('does not allow non-owners to remove feature flag addresses', async () => {
    await assertRevert(
      FeatureFlagModule.connect(user).removeFromFeatureFlag(
        FEATURE_FLAG_NAME,
        permissionedUser.address
      ),
      'Unauthorized'
    );

    await assertRevert(
      FeatureFlagModule.connect(permissionedUser).removeFromFeatureFlag(
        FEATURE_FLAG_NAME,
        permissionedUser.address
      ),
      'Unauthorized'
    );
  });

  describe('remove permissioned user from feature flag', async () => {
    let removeAddressTx;

    before('remove user', async () => {
      removeAddressTx = await FeatureFlagModule.connect(owner).removeFromFeatureFlag(
        FEATURE_FLAG_NAME,
        permissionedUser.address
      );
    });

    it('emits event', async () => {
      await assertEvent(
        removeAddressTx,
        `FeatureFlagAddressRemoved("${FEATURE_FLAG_NAME}", "${permissionedUser.address}")`,
        FeatureFlagModule
      );
    });

    it('does not allow removed permissionedUser to set value', async () => {
      await assertRevert(
        SampleFeatureFlagModule.connect(permissionedUser).setFeatureFlaggedValue(25),
        'Unauthorized'
      );
    });
  });

  describe('disable feature flag for all', async () => {
    before('disable feature flag', async () => {
      await FeatureFlagModule.connect(owner).setFeatureFlag(FEATURE_FLAG_NAME, false);
    });

    it('reverts when feature flag is disabled', async () => {
      await assertRevert(
        SampleFeatureFlagModule.connect(permissionedUser).setFeatureFlaggedValue(25),
        'FeatureUnavailable'
      );
    });
  });
});
