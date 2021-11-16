const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const bootstrap = require('../../helpers/bootstrap');

describe('SynthsModule', function () {
  const { deploymentInfo } = bootstrap();

  const sUSD = ethers.utils.formatBytes32String('sUSD');

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  let SynthsModule;
  before('identify modules', async () => {
    const proxyAddress = getProxyAddress(deploymentInfo);
    SynthsModule = await ethers.getContractAt('SynthsModule', proxyAddress);
  });

  describe('When a beacon is deployed', async () => {
    describe('when a non-owner tries to deploy', () => {
      it('reverts', async () => {
        await assertRevert(SynthsModule.connect(user).deployBeacon(), 'OnlyOwnerAllowed()');
      });
    });

    describe('when the owner deploys the beacon', () => {
      let beaconAddress, receipt;

      before('deployBeacon()', async () => {
        const tx = await SynthsModule.connect(owner).deployBeacon();
        receipt = await tx.wait();
      });

      it('emits a BeaconDeployed event', async () => {
        const event = findEvent({ receipt, eventName: 'BeaconDeployed' });
        beaconAddress = event.args.beacon;
      });

      it('shows that the beacon address is set in storage', async () => {
        assert.equal(await SynthsModule.getBeacon(), beaconAddress);
      });

      describe('when trying to redeploy', () => {
        it('reverts', async () => {
          await assertRevert(SynthsModule.connect(owner).deployBeacon(), 'BeaconAlreadyDeployed()');
        });
      });

      describe('When an implementation is set/upgraded', async () => {
        let synthImplementation;

        before('deploy an implementation', async () => {
          const factory = await ethers.getContractFactory('SynthMock');
          synthImplementation = await factory.deploy();
        });

        describe('when a non-owner tries to upgrade', () => {
          it('reverts', async () => {
            await assertRevert(
              SynthsModule.connect(user).upgradeSynthImplementation(synthImplementation.address),
              'OnlyOwnerAllowed()'
            );
          });
        });

        describe('when the owner upgrades the implementation', () => {
          before('upgradeSynthImplementation()', async () => {
            const tx = await SynthsModule.connect(owner).upgradeSynthImplementation(
              synthImplementation.address
            );
            await tx.wait();
          });

          it('shows that the implementation address is set', async () => {
            assert.equal(await SynthsModule.getSynthImplementation(), synthImplementation.address);
          });
        });

        describe('When deploying synths', async () => {
          describe('when a non-owner tries to deploy', () => {
            it('reverts', async () => {
              await assertRevert(
                SynthsModule.connect(user).deploySynth(sUSD),
                'OnlyOwnerAllowed()'
              );
            });
          });

          describe('when the owner deploys synths', () => {
            let synthAddress;

            before('deploySynth()', async () => {
              const tx = await SynthsModule.connect(owner).deploySynth(sUSD);
              receipt = await tx.wait();
            });

            it('emits a SynthDeployed event', async () => {
              const event = findEvent({ receipt, eventName: 'SynthDeployed' });
              assert.equal(event.args.synth, sUSD);
              synthAddress = event.args.synthAddress;
            });

            it('shows that the synth is stored correctly', async () => {
              assert.equal(await SynthsModule.getSynth(sUSD), synthAddress);
            });

            describe('when trying to deploy an existing synth', () => {
              it('reverts', async () => {
                await assertRevert(SynthsModule.deploySynth(sUSD), 'SynthAlreadyDeployed()');
              });
            });
          });
        });
      });
    });
  });
});
