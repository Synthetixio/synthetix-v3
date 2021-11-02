const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const bootstrap = require('./helpers/bootstrap');

describe.only('SynthFactoryModule', function () {
  const { deploymentInfo, initSystem } = bootstrap();

  const sUSD = ethers.utils.formatBytes32String('sUSD');

  let owner, nonOwner;
  before('initialize the system', async () => {
    await initSystem();
    [owner, nonOwner] = await ethers.getSigners();
  });

  let SynthFactoryModule, ERC20Implementation;
  before('identify modules', async () => {
    const proxyAddress = getProxyAddress(deploymentInfo);
    SynthFactoryModule = await ethers.getContractAt('SynthFactoryModule', proxyAddress);
    const factory = await ethers.getContractFactory('ERC20Mock');
    ERC20Implementation = await factory.deploy('Synthetic Token', 'synth', 18);
  });

  describe('initially the implementation should be 0x0', async () => {
    it('should be 0x0', async () => {
      const implementation = await SynthFactoryModule.getImplementation();
      assert.equal(implementation, '0x0000000000000000000000000000000000000000');
    });
  });

  describe('When the implementation is upgraded', async () => {
    describe('When called by a non-owner', async () => {
      it('reverts', async () => {
        await assertRevert(
          SynthFactoryModule.connect(nonOwner).upgradeSynthImplementation(nonOwner.address),
          'OnlyOwnerAllowed()'
        );
      });

      describe('When called by the owner', async () => {
        before('upgradeSynthImplementation', async () => {
          const tx = await SynthFactoryModule.connect(owner).upgradeSynthImplementation(
            ERC20Implementation.address
          );
          await tx.wait();
        });

        it('should updgrade the implementation', async () => {
          const implementation = await SynthFactoryModule.getImplementation();
          assert.equal(implementation, ERC20Implementation.address);
        });
      });

      describe('When a new synth is deployed', async () => {
        describe('When called by a non-owner', async () => {
          it('reverts', async () => {
            await assertRevert(
              SynthFactoryModule.connect(nonOwner).deployNewSynth(sUSD),
              'OnlyOwnerAllowed()'
            );
          });

          describe('When called by the owner', async () => {
            let receipt, synthAddress, event;
            before('deployNewSynth', async () => {
              const tx = await SynthFactoryModule.connect(owner).deployNewSynth(sUSD);
              receipt = await tx.wait();
            });

            before('Identify newly deployed synth', async () => {
              event = findEvent({ receipt, eventName: 'NewSynthDeployed' });
              synthAddress = event.args.synthProxyAddress;
            });

            it('should add the synth to the mapping', async () => {
              const proxyAddress = await SynthFactoryModule.getSynthProxy(sUSD);
              assert.equal(proxyAddress, synthAddress);
            });

            it('should emit the corresponding event with the right arguments', async () => {
              assert.equal(event.args.synth, sUSD);
              assert.notEqual(
                event.synthProxyAddress,
                '0x0000000000000000000000000000000000000000'
              );
            });
          });
        });
      });
    });
  });
});
