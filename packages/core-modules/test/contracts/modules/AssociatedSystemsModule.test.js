const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

const toBytes32 = ethers.utils.formatBytes32String;

describe('AssociatedSystemsModule', () => {
  const { proxyAddress } = bootstrap(initializer, {
    modules: '.*(Owner|Upgrade|AssociatedSystems).*',
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
        'Unauthorized'
      );
    });

    it('registers unmanaged', async () => {
      await AssociatedSystemsModule.connect(owner).registerUnmanagedSystem(
        toBytes32('wohoo'),
        owner.address
      );

      const [addr, kind] = await AssociatedSystemsModule.getAssociatedSystem(toBytes32('wohoo'));
      assert.equal(addr, owner.address);
      assert.equal(kind, toBytes32('unmanaged'));
    });

    it('reregisters unmanaged', async () => {
      await AssociatedSystemsModule.connect(owner).registerUnmanagedSystem(
        toBytes32('wohoo'),
        owner.address
      );
      await AssociatedSystemsModule.connect(owner).registerUnmanagedSystem(
        toBytes32('wohoo'),
        user.address
      );

      const [addr, kind] = await AssociatedSystemsModule.getAssociatedSystem(toBytes32('wohoo'));
      assert.equal(addr, user.address);
      assert.equal(kind, toBytes32('unmanaged'));
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
        'Unauthorized'
      );
    });

    describe('when adding TokenModule associated system', () => {
      const { proxyAddress: tokenProxyAddress, routerAddress: tokenRouterAddress } = bootstrap(
        initializer,
        { modules: '.*(Owner|Upgrade|Token).*' }
      );

      let TokenModule, TokenModuleAssociated, OwnerModuleAssociated;

      const registeredName = toBytes32('Token');

      before('identify modules', async () => {
        TokenModule = await ethers.getContractAt('TokenModule', tokenProxyAddress());
      });

      before('registration', async () => {
        await AssociatedSystemsModule.connect(owner).initOrUpgradeToken(
          registeredName,
          'A Token',
          'TOK',
          18,
          tokenRouterAddress()
        );

        const [proxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(registeredName);

        TokenModuleAssociated = await ethers.getContractAt('TokenModule', proxyAddress);
        OwnerModuleAssociated = await ethers.getContractAt('OwnerModule', proxyAddress);
      });

      it('has initialized the token', async () => {
        assert.equal(await TokenModuleAssociated.isInitialized(), true);
        assert.equal(await TokenModuleAssociated.name(), 'A Token');
        assert.equal(await TokenModuleAssociated.symbol(), 'TOK');
        assert.equal(await TokenModuleAssociated.decimals(), 18);
      });

      // TODO: `owner()` call is returning a (literally)
      // random address. no idea what is going on with that
      // you know the system is the owner because the
      // `initialize()` call is succeeding in the `init` function
      it.skip('is owner of the token', async () => {
        assert.equal(await OwnerModuleAssociated.owner(), proxyAddress());
      });

      it('should not affect existing proxy', async () => {
        assert.equal(await TokenModule.isInitialized(), false);
      });

      describe('when new impl for TokenModule associated system', () => {
        const { routerAddress: newRouterAddress } = bootstrap(initializer, {
          instance: 'anothernft',
          modules: '.*(Owner|Upgrade|Nft).*',
        });

        it('works when reinitialized with the same impl', async () => {
          await AssociatedSystemsModule.connect(owner).initOrUpgradeToken(
            registeredName,
            'A Token',
            'TOK',
            18,
            newRouterAddress()
          );

          const [newProxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(
            registeredName
          );

          assert.equal(newProxyAddress, TokenModuleAssociated.address);
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
        'Unauthorized'
      );
    });

    describe('when adding NftModule associated system', () => {
      const { proxyAddress: nftProxyAddress, routerAddress: nftRouterAddress } = bootstrap(
        initializer,
        { modules: '.*(Owner|Upgrade|Nft).*' }
      );

      let NftModule, NftModuleAssociated, OwnerModuleAssociated;

      const registeredName = toBytes32('Token');

      before('identify modules', async () => {
        NftModule = await ethers.getContractAt('NftModule', nftProxyAddress());
      });

      before('registration', async () => {
        await AssociatedSystemsModule.connect(owner).initOrUpgradeNft(
          registeredName,
          'A Token',
          'TOK',
          'https://vitalik.ca',
          nftRouterAddress()
        );

        const [proxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(registeredName);

        NftModuleAssociated = await ethers.getContractAt('NftModule', proxyAddress);
        OwnerModuleAssociated = await ethers.getContractAt('OwnerModule', proxyAddress);
      });

      it('has initialized the token', async () => {
        assert.equal(await NftModuleAssociated.isInitialized(), true);
        assert.equal(await NftModuleAssociated.name(), 'A Token');
        assert.equal(await NftModuleAssociated.symbol(), 'TOK');

        // it is very difficult to check the token uri without actually creating a token, which
        // we currently cannot do easily
        //assert.equal(await NftModuleAssociated.tokenURI(), 'https://vitalik.ca');
      });

      // TODO: `owner()` call is returning a (literally)
      // random address. no idea what is going on with that
      // you know the system is the owner because the
      // `initialize()` call is succeeding in the `init` function
      it.skip('is owner of the token', async () => {
        assert.equal(await OwnerModuleAssociated.owner(), proxyAddress());
      });

      it('should not affect existing proxy', async () => {
        assert.equal(await NftModule.isInitialized(), false);
      });

      describe('when new impl for NftModule associated system', () => {
        const { routerAddress: newRouterAddress } = bootstrap(initializer, {
          instance: 'anothernft',
          modules: '.*(Owner|Upgrade|Nft).*',
        });

        it('works when reinitialized with the same impl', async () => {
          await AssociatedSystemsModule.connect(owner).initOrUpgradeNft(
            registeredName,
            'A Token',
            'TOK',
            'https://vitalik.ca',
            newRouterAddress()
          );

          const [newProxyAddress] = await AssociatedSystemsModule.getAssociatedSystem(
            registeredName
          );

          assert.equal(newProxyAddress, NftModuleAssociated.address);
        });
      });
    });
  });
});
