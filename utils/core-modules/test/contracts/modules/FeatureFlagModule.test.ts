import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import { FeatureFlagModule, SampleFeatureFlagModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('FeatureFlagModule', function () {
  const { getContractBehindProxy, getSigners } = bootstrap({
    implementation: 'FeatureFlagModuleRouter',
  });

  let FeatureFlagModule: FeatureFlagModule;
  let SampleFeatureFlagModule: SampleFeatureFlagModule;
  let permissionedUser: ethers.Signer;
  let user: ethers.Signer;
  let denier1: ethers.Signer, denier2: ethers.Signer, denier3: ethers.Signer;

  const FEATURE_FLAG_NAME = ethers.utils.formatBytes32String('SAMPLE_FEATURE');

  before('identify signers', function () {
    [, permissionedUser, user, denier1, denier2, denier3] = getSigners();
  });

  before('identify modules', function () {
    FeatureFlagModule = getContractBehindProxy('FeatureFlagModule');
    SampleFeatureFlagModule = getContractBehindProxy('SampleFeatureFlagModule');
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

    it('allows addToFeatureFlagAllowlist to be called a second time without consequence', async function () {
      await FeatureFlagModule.addToFeatureFlagAllowlist(
        FEATURE_FLAG_NAME,
        await permissionedUser.getAddress()
      );

      assert.equal(
        (await FeatureFlagModule.getFeatureFlagAllowlist(FEATURE_FLAG_NAME)).toString(),
        [await permissionedUser.getAddress()].toString()
      );
    });
  });

  describe('call function behind feature flag', async function () {
    it('reverts when user does not have permission', async function () {
      await assertRevert(
        SampleFeatureFlagModule.connect(user).setFeatureFlaggedValue(15),
        `FeatureUnavailable(${FEATURE_FLAG_NAME})`
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
        `FeatureUnavailable(${FEATURE_FLAG_NAME})`
      );
    });

    it('allows removeFromFeatureFlagAllowlist to be called a second time without consequence', async function () {
      await FeatureFlagModule.removeFromFeatureFlagAllowlist(
        FEATURE_FLAG_NAME,
        await permissionedUser.getAddress()
      );

      assert.equal(
        (await FeatureFlagModule.getFeatureFlagAllowlist(FEATURE_FLAG_NAME)).toString(),
        [].toString()
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

  describe('set denyAll for a feature flag', async function () {
    let denyAllTx: ethers.ContractTransaction;

    before('deny all', async function () {
      denyAllTx = await FeatureFlagModule.setFeatureFlagDenyAll(FEATURE_FLAG_NAME, true);
    });

    it('emits event', async function () {
      await assertEvent(
        denyAllTx,
        `FeatureFlagDenyAllSet("${FEATURE_FLAG_NAME}", true)`,
        FeatureFlagModule
      );
    });

    it('does not allow a user to set value when denyAll is true', async function () {
      await assertRevert(
        SampleFeatureFlagModule.connect(permissionedUser).setFeatureFlaggedValue(25),
        `FeatureUnavailable(${FEATURE_FLAG_NAME})`
      );
    });

    it('does allow only owner to set value', async function () {
      await assertRevert(
        FeatureFlagModule.connect(permissionedUser).setFeatureFlagDenyAll(FEATURE_FLAG_NAME, true),
        `Unauthorized("${await permissionedUser.getAddress()}")`
      );
    });
    it('returns true when checking if denyAll is active', async function () {
      const isTrue = await FeatureFlagModule.getFeatureFlagDenyAll(FEATURE_FLAG_NAME);
      assert.strictEqual(isTrue, true);
    });
  });

  describe('setDeniers()', async () => {
    it('only allows owner to call', async () => {
      await assertRevert(
        FeatureFlagModule.connect(denier1).setDeniers(FEATURE_FLAG_NAME, []),
        'Unauthorized(',
        FeatureFlagModule
      );
    });

    describe('when invoked successfully', async () => {
      let txn: ethers.providers.TransactionReceipt;

      before('set deniers', async () => {
        txn = await (
          await FeatureFlagModule.setDeniers(FEATURE_FLAG_NAME, [
            await denier1.getAddress(),
            await denier2.getAddress(),
            await denier3.getAddress(),
          ])
        ).wait();
      });

      it('has correct deniers', async () => {
        const addrs = await FeatureFlagModule.getDeniers(FEATURE_FLAG_NAME);
        assert(addrs.length === 3);
        assert(addrs.includes(await denier1.getAddress()));
        assert(addrs.includes(await denier2.getAddress()));
        assert(addrs.includes(await denier3.getAddress()));
      });

      it('emits event', async () => {
        await assertEvent(
          txn,
          `FeatureFlagDeniersReset("${FEATURE_FLAG_NAME}",`,
          FeatureFlagModule
        );
      });

      it('does not revert when any of the deniers attempt to deny all', async () => {
        await FeatureFlagModule.connect(denier1).callStatic.setFeatureFlagDenyAll(
          FEATURE_FLAG_NAME,
          true
        );
        await FeatureFlagModule.connect(denier2).callStatic.setFeatureFlagDenyAll(
          FEATURE_FLAG_NAME,
          true
        );
        await FeatureFlagModule.connect(denier3).callStatic.setFeatureFlagDenyAll(
          FEATURE_FLAG_NAME,
          true
        );
      });

      describe('when denier has denied', async () => {
        before('deny', async () => {
          await FeatureFlagModule.connect(denier1).setFeatureFlagDenyAll(FEATURE_FLAG_NAME, true);
        });

        it('cant be undone by the denier', async () => {
          await assertRevert(
            FeatureFlagModule.connect(denier1).setFeatureFlagDenyAll(
              FEATURE_FLAG_NAME,
              false // this is disabling the denyAll flag
            ),
            'Unauthorized(',
            FeatureFlagModule
          );
        });

        it('the owner can undo feature flag deny all', async () => {
          await FeatureFlagModule.setFeatureFlagDenyAll(
            FEATURE_FLAG_NAME,
            false // this is disabling the denyAll flag
          );
        });
      });

      describe('when invoked a second time', async () => {
        before('set deniers again', async () => {
          await FeatureFlagModule.setDeniers(FEATURE_FLAG_NAME, [
            await denier3.getAddress(),
            await denier2.getAddress(),
          ]);
        });

        it('sets new deniers correctly', async () => {
          const addrs = await FeatureFlagModule.getDeniers(FEATURE_FLAG_NAME);
          assert(addrs.length === 2);
          assert(addrs.includes(await denier2.getAddress()));
          assert(addrs.includes(await denier3.getAddress()));
        });

        it('removed signer should no longer have capability', async () => {
          await assertRevert(
            FeatureFlagModule.connect(denier1).setFeatureFlagDenyAll(FEATURE_FLAG_NAME, true),
            `Unauthorized("${await denier1.getAddress()}")`,
            FeatureFlagModule
          );
        });
      });
    });
  });
});
