const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('SynthsModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  const sUSD = ethers.utils.formatBytes32String('sUSD');
  const name = 'Synthetic USD';
  const symbol = 'sUSD';
  const decimals = 18;

  let owner, user;

  let receipt;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  let SynthsModule, synthImplementationAddress;

  before('identify modules', async () => {
    SynthsModule = await ethers.getContractAt('SynthsModule', proxyAddress());
  });

  describe('when an implemetation is created', () => {
    before('create an implementation', async () => {
      const tx = await SynthsModule.createSynthImplementation();
      receipt = await tx.wait();
    });

    it('emits a SynthImplementationCreated event', async () => {
      const event = findEvent({ receipt, eventName: 'SynthImplementationCreated' });
      synthImplementationAddress = event.args.implementationAddress;
    });

    describe('When the beacon is NOT deployed', async () => {
      describe('when trying to upgrade an impementation', () => {
        it('reverts', async () => {
          await assertRevert(
            SynthsModule.upgradeSynthImplementation(synthImplementationAddress),
            'NotInitialized()'
          );
        });

        describe('when trying to deploy a synth', () => {
          it('reverts', async () => {
            await assertRevert(
              SynthsModule.createSynth(sUSD, name, symbol, decimals),
              'NotInitialized()'
            );
          });
        });
      });

      describe('When a beacon is deployed', async () => {
        describe('when a non-owner tries to initialize the SynthsModule', () => {
          it('reverts', async () => {
            await assertRevert(SynthsModule.connect(user).initializeSynthsModule(), 'Unauthorized');
          });
        });

        describe('when the owner initialize the SynthsModule', () => {
          let beaconAddress;

          before('initializeSynthsModule()', async () => {
            const tx = await SynthsModule.connect(owner).initializeSynthsModule();
            receipt = await tx.wait();
          });

          it('emits a BeaconCreated event', async () => {
            const event = findEvent({ receipt, eventName: 'BeaconCreated' });
            beaconAddress = event.args.beacon;
          });

          it('shows that the SynthsModule is initialized', async () => {
            assert.equal(await SynthsModule.isSynthsModuleInitialized(), true);
          });

          it('shows that the beacon address is set in storage', async () => {
            assert.equal(await SynthsModule.getSynthBeacon(), beaconAddress);
          });

          describe('when trying to re initialize the module', () => {
            it('reverts', async () => {
              await assertRevert(
                SynthsModule.connect(owner).initializeSynthsModule(),
                'AlreadyInitialized()'
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
                  SynthsModule.connect(user).upgradeSynthImplementation(synthImplementationAddress),
                  'Unauthorized'
                );
              });
            });

            describe('when the owner upgrades the implementation', () => {
              before('upgradeSynthImplementation()', async () => {
                const tx = await SynthsModule.connect(owner).upgradeSynthImplementation(
                  synthImplementationAddress
                );
                await tx.wait();
              });

              it('shows that the implementation address is set', async () => {
                assert.equal(
                  await SynthsModule.getSynthImplementation(),
                  synthImplementationAddress
                );
              });
            });

            describe('When deploying synths', async () => {
              describe('when a non-owner tries to deploy', () => {
                it('reverts', async () => {
                  await assertRevert(
                    SynthsModule.connect(user).createSynth(sUSD, name, symbol, decimals),
                    'Unauthorized'
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

                it('gets the newly created satellite', async () => {
                  const [result] = await SynthsModule.getSynthsModuleSatellites();
                  assert.equal(result.name, sUSD);
                  assert.equal(result.contractName, ethers.utils.formatBytes32String('ISynth'));
                  assert.equal(result.deployedAddress, synthAddress);
                });

                describe('when trying to deploy an existing synth', () => {
                  it('reverts', async () => {
                    await assertRevert(
                      SynthsModule.createSynth(sUSD, name, symbol, decimals),
                      'SynthAlreadyCreated()'
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
});
