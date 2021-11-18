const assert = require('assert');
const { ethers } = hre;
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const bn = require('@synthetixio/core-js/utils/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('SNXTokenModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1;

  before('identify signers', async () => {
    [owner, user1] = await ethers.getSigners();
  });

  describe('When creating the SNX token', async () => {
    let SNXTokenModule, snxTokenAddress, SNX;
    before('identify modules', async () => {
      SNXTokenModule = await ethers.getContractAt('SNXTokenModule', proxyAddress);
    });

    it('No SNX is deployed', async () => {
      const address = await SNXTokenModule.getSNXTokenAddress();
      assert.equal(address, '0x0000000000000000000000000000000000000000');
    });

    describe('When the SNX is created', () => {
      let receipt;
      before('Create a SNX token', async () => {
        const tx = await SNXTokenModule.connect(owner).createSNX();
        receipt = await tx.wait();
      });

      before('Identify newly created SNX', async () => {
        const event = findEvent({ receipt, eventName: 'SNXTokenCreated' });
        snxTokenAddress = event.args.snxAddress;
        SNX = await ethers.getContractAt('SNXToken', snxTokenAddress);
      });

      it('emmited an event', async () => {
        assert.notEqual(snxTokenAddress, '0x0000000000000000000000000000000000000000');
      });

      it('gets the newly created address', async () => {
        const address = await SNXTokenModule.getSNXTokenAddress();
        assert.equal(address, snxTokenAddress);
      });

      it('reads the SNX parameters', async () => {
        assert.equal(await SNX.name(), 'Synthetix Network Token');
        assert.equal(await SNX.symbol(), 'snx');
        assert.equal(await SNX.decimals(), 18);
      });

      describe('When attempting to create the SNX twice', () => {
        it('reverts', async () => {
          await assertRevert(SNXTokenModule.connect(owner).createSNX(), 'SNXAlreadyCreated()');
        });
      });

      describe('When attempting to upgrade to a new implementation', () => {
        let AnotherSNXToken, NewSNX;

        before('Deploy new implementation', async () => {
          const factory = await ethers.getContractFactory('SNXTokenMock');
          AnotherSNXToken = await factory.deploy();
        });

        before('Upgrade to new implementation', async () => {
          const tx = await SNXTokenModule.connect(owner).upgradeSNXImplementation(
            AnotherSNXToken.address
          );

          await tx.wait();
        });

        it('is upgraded', async () => {
          NewSNX = await ethers.getContractAt('SNXTokenMock', snxTokenAddress);
          assert.equal(AnotherSNXToken.address, await NewSNX.getImplementation());
        });

        it('reads the upgraded SNX parameters', async () => {
          assert.equal(await NewSNX.name(), 'Synthetix Network Token');
          assert.equal(await NewSNX.symbol(), 'snx');
          assert.equal(await NewSNX.decimals(), 18);
        });

        describe('New SNX can mint', () => {
          const totalSupply = ethers.BigNumber.from('1000000');

          before('mint', async () => {
            const tx = await NewSNX.connect(user1).mint(totalSupply);
            await tx.wait();
          });

          it('updates the total supply', async () => {
            bn.eq(await NewSNX.totalSupply(), totalSupply);
          });
        });
      });
    });
  });
});
