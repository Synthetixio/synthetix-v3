import assert from 'node:assert/strict';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { ethers } from 'ethers';
import { AssociatedSystemsModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

const toBytes32 = ethers.utils.formatBytes32String;

describe('AssociatedSystemsModule', () => {
  const { proxyAddress } = bootstrap(initializer, {
    modules: ['OwnerModule', 'UpgradeModule', 'AssociatedSystemsModule'],
  });

  let AssociatedSystemsModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    AssociatedSystemsModule = await ethers.getContractAt('AssociatedSystemsModule', proxyAddress());
  });

  describe('registerUnmanagedSystem()', async () => {
    it('only callable by owner', async () => {
      await assertRevert(
        AssociatedSystemsModule.connect(user).registerUnmanagedSystem(
          toBytes32('wohoo'),
          owner.address
        ),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    it('registers unmanaged', async () => {
      const receipt = await (
        await AssociatedSystemsModule.connect(owner).registerUnmanagedSystem(
          toBytes32('wohoo'),
          owner.address
        )
      ).wait();

      const [addr, kind] = await AssociatedSystemsModule.getAssociatedSystem(toBytes32('wohoo'));
      assert.equal(addr, owner.address);
      assert.equal(kind, toBytes32('unmanaged'));

      const event = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

      assert.ok(event);
      assert.equal(event.args.kind, toBytes32('unmanaged'));
      assert.equal(event.args.id, toBytes32('wohoo'));
      assert.equal(event.args.proxy, owner.address);
    });

    it('re-registers unmanaged', async () => {
      await AssociatedSystemsModule.connect(owner).registerUnmanagedSystem(
        toBytes32('wohoo'),
        owner.address
      );
      const receipt = await (
        await AssociatedSystemsModule.connect(owner).registerUnmanagedSystem(
          toBytes32('wohoo'),
          user.address
        )
      ).wait();

      const [addr, kind] = await AssociatedSystemsModule.getAssociatedSystem(toBytes32('wohoo'));
      assert.equal(addr, user.address);
      assert.equal(kind, toBytes32('unmanaged'));

      const event = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

      assert.ok(event);
      assert.equal(event.args.kind, toBytes32('unmanaged'));
      assert.equal(event.args.id, toBytes32('wohoo'));
      assert.equal(event.args.proxy, user.address);
    });
  });

  describe('initOrUpgradeToken()', async () => {
    it('only callable by owner', async () => {
      await assertRevert(
        AssociatedSystemsModule.connect(user).initOrUpgradeToken(
          toBytes32('hello'),
          'A Token',
          'TOK',
          18,
          owner.address
        ),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    describe('when adding TokenModule associated system', () => {
      const { proxyAddress: tokenProxyAddress, routerAddress: tokenRouterAddress } = bootstrap(
        initializer,
        {
          modules: ['OwnerModule', 'UpgradeModule', 'TokenModule'],
        }
      );

      let receipt;

      let TokenModule, TokenModuleAssociated, OwnerModuleAssociated;

      const registeredName = toBytes32('Token');

      before('identify modules', async () => {
        TokenModule = await ethers.getContractAt('TokenModule', tokenProxyAddress());
      });

      before('registration', async () => {
        receipt = await (
          await AssociatedSystemsModule.connect(owner).initOrUpgradeToken(
            registeredName,
            'A Token',
            'TOK',
            18,
            tokenRouterAddress()
          )
        ).wait();

        const [proxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(registeredName);

        TokenModuleAssociated = await ethers.getContractAt('TokenModule', proxyAddress);
        OwnerModuleAssociated = await ethers.getContractAt('OwnerModule', proxyAddress);
      });

      it('emitted event', async () => {
        const event = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

        assert.ok(event);
        assert.equal(event.args.kind, toBytes32('erc20'));
        assert.equal(event.args.id, registeredName);
        assert.equal(event.args.proxy, TokenModuleAssociated.address);
        assert.equal(event.args.impl, tokenRouterAddress());
      });

      it('has initialized the token', async () => {
        assert.equal(await TokenModuleAssociated.isInitialized(), true);
        assert.equal(await TokenModuleAssociated.name(), 'A Token');
        assert.equal(await TokenModuleAssociated.symbol(), 'TOK');
        assert.equal(await TokenModuleAssociated.decimals(), 18);
      });

      it('is owner of the token', async () => {
        assert.equal(await OwnerModuleAssociated.owner(), proxyAddress());
      });

      it('should not affect existing proxy', async () => {
        assert.equal(await TokenModule.isInitialized(), false);
      });

      describe('when attempting to register a different kind', function () {
        const { routerAddress: nftRouterAddress } = bootstrap(() => {}, {
          modules: ['OwnerModule', 'UpgradeModule', 'NftModule'],
        });

        let InvalidTokenModule;

        before('prepare modules', async () => {
          const factory = await ethers.getContractFactory('TokenModule');
          InvalidTokenModule = await factory.deploy();

          await AssociatedSystemsModule.connect(owner).initOrUpgradeNft(
            toBytes32('hello'),
            'A Token',
            'TOK',
            42,
            nftRouterAddress()
          );
        });

        it('fails with wrong kind error', async () => {
          await assertRevert(
            AssociatedSystemsModule.connect(owner).initOrUpgradeToken(
              toBytes32('hello'),
              'A Token',
              'TOK',
              42,
              InvalidTokenModule.address
            ),
            `MismatchAssociatedSystemKind("${toBytes32('erc20')}", "${toBytes32('erc721')}")`
          );
        });
      });

      describe('when new impl for TokenModule associated system', () => {
        const { routerAddress: newRouterAddress } = bootstrap(initializer, {
          modules: ['OwnerModule', 'UpgradeModule', 'NftModule'],
        });

        before('reinit', async () => {
          receipt = await (
            await AssociatedSystemsModule.connect(owner).initOrUpgradeToken(
              registeredName,
              'A Token',
              'TOK',
              18,
              newRouterAddress()
            )
          ).wait();
        });

        it('works when reinitialized with the same impl', async () => {
          const [newProxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(
            registeredName
          );

          assert.equal(newProxyAddress, TokenModuleAssociated.address);
        });

        it('emitted event', async () => {
          const event = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

          assert.ok(event);
          assert.equal(event.args.kind, toBytes32('erc20'));
          assert.equal(event.args.id, registeredName);
          assert.equal(event.args.proxy, TokenModuleAssociated.address);
          assert.equal(event.args.impl, newRouterAddress());
        });
      });
    });
  });

  describe('initOrUpgradeNft()', () => {
    it('only callable by owner', async () => {
      await assertRevert(
        AssociatedSystemsModule.connect(user).initOrUpgradeNft(
          toBytes32('hello'),
          'A Token',
          'TOK',
          18,
          owner.address
        ),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    describe('when adding NftModule associated system', () => {
      const { proxyAddress: nftProxyAddress, routerAddress: nftRouterAddress } = bootstrap(
        initializer,
        {
          modules: ['OwnerModule', 'UpgradeModule', 'NftModule'],
        }
      );

      let receipt;

      let NftModule, NftModuleAssociated, OwnerModuleAssociated;

      const registeredName = toBytes32('Token');

      before('identify modules', async () => {
        NftModule = await ethers.getContractAt('NftModule', nftProxyAddress());
      });

      before('registration', async () => {
        receipt = await (
          await AssociatedSystemsModule.connect(owner).initOrUpgradeNft(
            registeredName,
            'A Token',
            'TOK',
            'https://vitalik.ca',
            nftRouterAddress()
          )
        ).wait();

        const [proxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(registeredName);

        NftModuleAssociated = await ethers.getContractAt('NftModule', proxyAddress);
        OwnerModuleAssociated = await ethers.getContractAt('OwnerModule', proxyAddress);
      });

      it('emitted event', async () => {
        const event = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

        assert.ok(event);
        assert.equal(event.args.kind, toBytes32('erc721'));
        assert.equal(event.args.id, registeredName);
        assert.equal(event.args.proxy, NftModuleAssociated.address);
        assert.equal(event.args.impl, nftRouterAddress());
      });

      it('has initialized the token', async () => {
        assert.equal(await NftModuleAssociated.isInitialized(), true);
        assert.equal(await NftModuleAssociated.name(), 'A Token');
        assert.equal(await NftModuleAssociated.symbol(), 'TOK');

        // it is very difficult to check the token uri without actually creating a token, which
        // we currently cannot do easily
        //assert.equal(await NftModuleAssociated.tokenURI(), 'https://vitalik.ca');
      });

      it('is owner of the token', async () => {
        assert.equal(await OwnerModuleAssociated.owner(), proxyAddress());
      });

      it('should not affect existing proxy', async () => {
        assert.equal(await NftModule.isInitialized(), false);
      });

      describe('when attempting to register a different kind', function () {
        const { routerAddress: tokenRouterAddress } = bootstrap(() => {}, {
          modules: ['OwnerModule', 'UpgradeModule', 'TokenModule'],
        });

        let InvalidTokenModule;

        before('prepare modules', async () => {
          const factory = await ethers.getContractFactory('TokenModule');
          InvalidTokenModule = await factory.deploy();

          await AssociatedSystemsModule.connect(owner).initOrUpgradeToken(
            toBytes32('hello'),
            'A Token',
            'TOK',
            42,
            tokenRouterAddress()
          );
        });

        it('fails with wrong kind error', async () => {
          await assertRevert(
            AssociatedSystemsModule.connect(owner).initOrUpgradeNft(
              toBytes32('hello'),
              'A Token',
              'TOK',
              42,
              InvalidTokenModule.address
            ),
            `MismatchAssociatedSystemKind("${toBytes32('erc721')}", "${toBytes32('erc20')}")`
          );
        });
      });

      describe('when new impl for NftModule associated system', () => {
        const { routerAddress: newRouterAddress } = bootstrap(initializer, {
          modules: ['OwnerModule', 'UpgradeModule', 'NftModule'],
        });

        before('reinit', async () => {
          receipt = await (
            await AssociatedSystemsModule.connect(owner).initOrUpgradeNft(
              registeredName,
              'A Token',
              'TOK',
              'https://vitalik.ca',
              newRouterAddress()
            )
          ).wait();
        });

        it('works when reinitialized with the same impl', async () => {
          const [newProxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(
            registeredName
          );

          assert.equal(newProxyAddress, NftModuleAssociated.address);
        });

        it('emitted event', async () => {
          const event = findEvent({ receipt, eventName: 'AssociatedSystemSet' });

          assert.ok(event);
          assert.equal(event.args.kind, toBytes32('erc721'));
          assert.equal(event.args.id, registeredName);
          assert.equal(event.args.proxy, NftModuleAssociated.address);
          assert.equal(event.args.impl, newRouterAddress());
        });
      });
    });
  });
});
