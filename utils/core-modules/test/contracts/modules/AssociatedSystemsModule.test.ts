import assert from 'node:assert/strict';
import { assertAddressEqual } from '@synthetixio/core-utils/utils/assertions/assert-address';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { ethers } from 'ethers';
import {
  AssociatedSystemsModule,
  NftModule,
  OwnerModule,
  TokenModule,
} from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

const toBytes32 = ethers.utils.formatBytes32String;

// tmp skip to allow for verifying the whole rest of the tests
describe('AssociatedSystemsModule', function () {
  const { getContractBehindProxy, getContract, getSigners } = bootstrap({
    implementation: 'AssociatedSystemsModuleRouter',
  });

  let AssociatedSystemsModule: AssociatedSystemsModule;
  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('initialize', function () {
    [owner, user] = getSigners();
    AssociatedSystemsModule = getContractBehindProxy('AssociatedSystemsModule');
  });

  describe('registerUnmanagedSystem()', async function () {
    it('only callable by owner', async function () {
      await assertRevert(
        AssociatedSystemsModule.connect(user).registerUnmanagedSystem(
          toBytes32('wohoo'),
          await owner.getAddress()
        ),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    it('registers unmanaged', async function () {
      const receipt = await (
        await AssociatedSystemsModule.registerUnmanagedSystem(
          toBytes32('wohoo'),
          await owner.getAddress()
        )
      ).wait();

      const [addr, kind] = await AssociatedSystemsModule.getAssociatedSystem(toBytes32('wohoo'));
      assert.equal(addr, await owner.getAddress());
      assert.equal(kind, toBytes32('unmanaged'));

      const evt = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

      assert.ok(evt && !Array.isArray(evt) && evt.args);
      assert.equal(evt.args.kind, toBytes32('unmanaged'));
      assert.equal(evt.args.id, toBytes32('wohoo'));
      assert.equal(evt.args.proxy, await owner.getAddress());
    });

    it('re-registers unmanaged', async function () {
      await AssociatedSystemsModule.registerUnmanagedSystem(
        toBytes32('wohoo'),
        await owner.getAddress()
      );
      const receipt = await (
        await AssociatedSystemsModule.registerUnmanagedSystem(
          toBytes32('wohoo'),
          await user.getAddress()
        )
      ).wait();

      const [addr, kind] = await AssociatedSystemsModule.getAssociatedSystem(toBytes32('wohoo'));
      assert.equal(addr, await user.getAddress());
      assert.equal(kind, toBytes32('unmanaged'));

      const evt = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

      assert.ok(evt && !Array.isArray(evt) && evt.args);
      assert.equal(evt.args.kind, toBytes32('unmanaged'));
      assert.equal(evt.args.id, toBytes32('wohoo'));
      assert.equal(evt.args.proxy, await user.getAddress());
    });
  });

  describe('initOrUpgradeToken()', async function () {
    it('only callable by owner', async function () {
      await assertRevert(
        AssociatedSystemsModule.connect(user).initOrUpgradeToken(
          toBytes32('hello'),
          'A Token',
          'TOK',
          18,
          await owner.getAddress()
        ),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    describe('when adding TokenModule associated system', function () {
      let TokenModule: TokenModule;
      let NftModule: NftModule;

      let TokenModuleAssociated: TokenModule;
      let OwnerModuleAssociated: OwnerModule;

      let receipt: ethers.ContractReceipt;

      const registeredName = toBytes32('Token');

      before('identify modules', async function () {
        NftModule = getContract('NftModuleRouter');
        TokenModule = getContract('TokenModuleRouter');
      });

      before('registration', async function () {
        const tx = await AssociatedSystemsModule.initOrUpgradeToken(
          registeredName,
          'A Token',
          'TOK',
          18,
          TokenModule.address
        );

        receipt = await tx.wait();

        const [proxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(registeredName);

        TokenModuleAssociated = getContract('TokenModule', proxyAddress);
        OwnerModuleAssociated = getContract('OwnerModule', proxyAddress);
      });

      it('emitted event', async function () {
        const evt = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

        assert.ok(evt && !Array.isArray(evt) && evt.args);
        assert.equal(evt.args.kind, toBytes32('erc20'));
        assert.equal(evt.args.id, registeredName);
        assertAddressEqual(evt.args.proxy, TokenModuleAssociated.address);
        assertAddressEqual(evt.args.impl, TokenModule.address);
      });

      it('has initialized the token', async function () {
        assert.equal(await TokenModuleAssociated.isInitialized(), true);
        assert.equal(await TokenModuleAssociated.name(), 'A Token');
        assert.equal(await TokenModuleAssociated.symbol(), 'TOK');
        assert.equal(await TokenModuleAssociated.decimals(), 18);
      });

      it('is owner of the token', async function () {
        const CoreProxy = getContractBehindProxy('Proxy');
        assert.equal(await OwnerModuleAssociated.owner(), CoreProxy.address);
      });

      it('should not affect existing proxy', async function () {
        assert.equal(await TokenModule.isInitialized(), false);
      });

      it('upgrade token with new name and symbol', async () => {
        await AssociatedSystemsModule.initOrUpgradeToken(
          registeredName,
          'A Token 2',
          'TOK2',
          18,
          TokenModule.address
        );
      });

      it('the token has been successfully reinitlized', async function () {
        assert.equal(await TokenModuleAssociated.isInitialized(), true);
        assert.equal(await TokenModuleAssociated.name(), 'A Token 2');
        assert.equal(await TokenModuleAssociated.symbol(), 'TOK2');
        assert.equal(await TokenModuleAssociated.decimals(), 18);
      });

      describe('when attempting to register a different kind', function () {
        before('prepare modules', async function () {
          await AssociatedSystemsModule.initOrUpgradeNft(
            toBytes32('hello'),
            'A Token',
            'TOK',
            'ipfs://some-uri',
            NftModule.address
          );
        });

        it('fails with wrong kind error', async function () {
          await assertRevert(
            AssociatedSystemsModule.initOrUpgradeToken(
              toBytes32('hello'),
              'A Token',
              'TOK',
              42,
              TokenModule.address
            ),
            `MismatchAssociatedSystemKind("${toBytes32('erc20')}", "${toBytes32('erc721')}")`
          );
        });
      });

      describe('when new impl for TokenModule associated system', function () {
        let NewTokenModule: TokenModule;

        before('reinit', async function () {
          NewTokenModule = getContract('TokenModuleRouter2');

          receipt = await (
            await AssociatedSystemsModule.initOrUpgradeToken(
              registeredName,
              'A Token',
              'TOK',
              18,
              NewTokenModule.address
            )
          ).wait();
        });

        it('works when reinitialized with the same impl', async function () {
          const [newProxyAddress] =
            await AssociatedSystemsModule.getAssociatedSystem(registeredName);

          assert.equal(newProxyAddress, TokenModuleAssociated.address);
        });

        it('emitted event', async function () {
          const evt = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

          assert.ok(evt && !Array.isArray(evt) && evt.args);
          assert.equal(evt.args.kind, toBytes32('erc20'));
          assert.equal(evt.args.id, registeredName);
          assertAddressEqual(evt.args.proxy, TokenModuleAssociated.address);
          assertAddressEqual(evt.args.impl, NewTokenModule.address);
        });
      });
    });
  });

  describe('initOrUpgradeNft()', function () {
    it('is only callable by owner', async function () {
      await assertRevert(
        AssociatedSystemsModule.connect(user).initOrUpgradeNft(
          toBytes32('hello'),
          'A Token',
          'TOK',
          'ipfs://some-uri',
          await owner.getAddress()
        ),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    describe('when adding NftModule associated system', function () {
      let NftModule: NftModule;

      let NftModuleAssociated: NftModule;
      let OwnerModuleAssociated: OwnerModule;

      let receipt: ethers.ContractReceipt;

      const registeredName = toBytes32('NftToken');

      before('identify modules', async function () {
        NftModule = await getContract('NftModuleRouter2');
      });

      before('registration', async function () {
        const tx = await AssociatedSystemsModule.initOrUpgradeNft(
          registeredName,
          'A Token',
          'TOK',
          'https://vitalik.ca',
          NftModule.address
        );

        receipt = await tx.wait();

        const [proxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(registeredName);

        NftModuleAssociated = getContract('NftModule', proxyAddress);
        OwnerModuleAssociated = getContract('OwnerModule', proxyAddress);
      });

      it('emitted event', async function () {
        const evt = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

        assert.ok(evt && !Array.isArray(evt) && evt.args);
        assert.equal(evt.args.kind, toBytes32('erc721'));
        assert.equal(evt.args.id, registeredName);
        assertAddressEqual(evt.args.proxy, NftModuleAssociated.address);
        assertAddressEqual(evt.args.impl, NftModule.address);
      });

      it('has initialized the token', async function () {
        assert.equal(await NftModuleAssociated.isInitialized(), true);
        assert.equal(await NftModuleAssociated.name(), 'A Token');
        assert.equal(await NftModuleAssociated.symbol(), 'TOK');
      });

      it('is owner of the token', async function () {
        const CoreProxy = getContractBehindProxy('Proxy');
        assert.equal(await OwnerModuleAssociated.owner(), CoreProxy.address);
      });

      it('should not affect existing proxy', async function () {
        assert.equal(await NftModule.isInitialized(), false);
      });

      describe('when attempting to register a different kind', function () {
        let NewTokenModule: TokenModule;

        const invalidRegisteredName = toBytes32('InvalidKind');

        before('prepare modules', async function () {
          NewTokenModule = await getContract('TokenModuleRouter3');

          await AssociatedSystemsModule.initOrUpgradeToken(
            invalidRegisteredName,
            'A Token',
            'TOK',
            42,
            NewTokenModule.address
          );
        });

        it('fails with wrong kind error', async function () {
          await assertRevert(
            AssociatedSystemsModule.initOrUpgradeNft(
              invalidRegisteredName,
              'A Token',
              'TOK',
              'ipfs://some-uri',
              NewTokenModule.address
            ),
            `MismatchAssociatedSystemKind("${toBytes32('erc721')}", "${toBytes32('erc20')}")`
          );
        });
      });

      describe('when new impl for NftModule associated system', function () {
        let NewNftModule: NftModule;

        before('reinit', async function () {
          NewNftModule = await getContract('NftModuleRouter3');

          receipt = await (
            await AssociatedSystemsModule.initOrUpgradeNft(
              registeredName,
              'A Token',
              'TOK',
              'https://vitalik.ca',
              NewNftModule.address
            )
          ).wait();
        });

        it('works when reinitialized with the same impl', async function () {
          const [newProxyAddress] =
            await AssociatedSystemsModule.getAssociatedSystem(registeredName);

          assert.equal(newProxyAddress, NftModuleAssociated.address);
        });

        it('emitted event', async function () {
          const evt = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

          assert.ok(evt && !Array.isArray(evt) && evt.args);
          assert.equal(evt.args.kind, toBytes32('erc721'));
          assert.equal(evt.args.id, registeredName);
          assertAddressEqual(evt.args.proxy, NftModuleAssociated.address);
          assertAddressEqual(evt.args.impl, NewNftModule.address);
        });
      });
    });
  });
});
