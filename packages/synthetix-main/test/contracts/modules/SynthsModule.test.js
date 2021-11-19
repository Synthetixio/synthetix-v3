const assert = require('assert');
const { ethers } = hre;
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('SynthsModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  const sUSD = ethers.utils.formatBytes32String('sUSD');
  const name = 'Synthetic USD';
  const symbol = 'sUSD';
  const decimals = 18;

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  let SynthsModule, synthImplementation;

  before('identify modules', async () => {
    SynthsModule = await ethers.getContractAt('SynthsModule', proxyAddress());
  });

  before('deploy an implementation', async () => {
    const factory = await ethers.getContractFactory('Synth');
    synthImplementation = await factory.deploy();
  });

  describe('When the beacon is NOT deployed', async () => {
    describe('when trying to upgrade an impementation', () => {
      it('reverts', async () => {
        await assertRevert(
          SynthsModule.upgradeSynthImplementation(synthImplementation.address),
          'BeaconNotCreated()'
        );
      });

      describe('when trying to deploy a synth', () => {
        it('reverts', async () => {
          await assertRevert(
            SynthsModule.createSynth(sUSD, name, symbol, decimals),
            'BeaconNotCreated()'
          );
        });
      });
    });

    describe('When a beacon is deployed', async () => {
      describe('when a non-owner tries to deploy', () => {
        it('reverts', async () => {
          await assertRevert(SynthsModule.connect(user).createBeacon(), 'OnlyOwnerAllowed()');
        });
      });

      describe('when the owner deploys the beacon', () => {
        let beaconAddress, receipt;

        before('createBeacon()', async () => {
          const tx = await SynthsModule.connect(owner).createBeacon();
          receipt = await tx.wait();
        });

        it('emits a BeaconCreated event', async () => {
          const event = findEvent({ receipt, eventName: 'BeaconCreated' });
          beaconAddress = event.args.beacon;
        });

        it('shows that the beacon address is set in storage', async () => {
          assert.equal(await SynthsModule.getBeacon(), beaconAddress);
        });

        describe('when trying to redeploy', () => {
          it('reverts', async () => {
            await assertRevert(
              SynthsModule.connect(owner).createBeacon(),
              'BeaconAlreadyCreated()'
            );
          });
        });

        describe('When there is NO implementation', async () => {
          describe('when trying to deploy a synth', () => {
            it('reverts', async () => {
              await assertRevert(
                SynthsModule.createSynth(sUSD, name, symbol, decimals),
                'ImplementationNotSet()'
              );
            });
          });
        });

        describe('When an implementation is set/upgraded', async () => {
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
              assert.equal(
                await SynthsModule.getSynthImplementation(),
                synthImplementation.address
              );
            });
          });

          describe('When deploying synths', async () => {
            describe('when a non-owner tries to deploy', () => {
              it('reverts', async () => {
                await assertRevert(
                  SynthsModule.connect(user).createSynth(sUSD, name, symbol, decimals),
                  'OnlyOwnerAllowed()'
                );
              });
            });

            describe('when the owner deploys synths', () => {
              let synthAddress;

              before('createSynth()', async () => {
                const tx = await SynthsModule.connect(owner).createSynth(
                  sUSD,
                  name,
                  symbol,
                  decimals
                );
                receipt = await tx.wait();
              });

              it('emits a SynthCreated event', async () => {
                const event = findEvent({ receipt, eventName: 'SynthCreated' });
                assert.equal(event.args.synth, sUSD);
                synthAddress = event.args.synthAddress;
              });

              it('shows that the synth is stored correctly', async () => {
                assert.equal(await SynthsModule.getSynth(sUSD), synthAddress);
              });

              describe('when trying to deploy an existing synth', () => {
                it('reverts', async () => {
                  await assertRevert(
                    SynthsModule.createSynth(sUSD, name, symbol, decimals),
                    'SynthAlreadyDeployed()'
                  );
                });
              });
            });
          });
        });
      });
    });
  });
});
