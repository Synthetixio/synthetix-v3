import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { Configurable, ConfigurableMock } from '../../../typechain-types';

describe('Configurable', function () {
  let Configurable: Configurable;
  let ConfigurableMock: ConfigurableMock;

  let owner: ethers.Signer;
  let configurer: ethers.Signer;
  let newConfigurer: ethers.Signer;
  let user: ethers.Signer;

  const addressZero = '0x0000000000000000000000000000000000000000';

  before('identify signers', async function () {
    [owner, configurer, newConfigurer, user] = await hre.ethers.getSigners();
  });

  before('deploy the contract', async function () {
    const factoryConfigurable = await hre.ethers.getContractFactory('Configurable');
    Configurable = await factoryConfigurable.deploy();
    const factoryConfigurableMock = await hre.ethers.getContractFactory('ConfigurableMock');
    ConfigurableMock = await factoryConfigurableMock.deploy(await owner.getAddress());
  });

  describe('before a configurer is set', function () {
    it('shows that the  configurer is 0x0', async function () {
      assert.equal(await Configurable.configurer(), addressZero);
      assert.equal(await ConfigurableMock.configurer(), addressZero);
    });

    it('shows that no new configurer is nominated', async function () {
      assert.equal(await Configurable.nominatedConfigurer(), addressZero);
      assert.equal(await ConfigurableMock.nominatedConfigurer(), addressZero);
    });
  });

  describe('when the owner sets the configurer during a nomination', function () {
    it('cancels the current nomination', async function () {
      await ConfigurableMock.connect(owner).setConfigurer(await configurer.getAddress());
      await ConfigurableMock.connect(configurer).nominateNewConfigurer(
        await newConfigurer.getAddress()
      );
      assert.equal(await ConfigurableMock.nominatedConfigurer(), await newConfigurer.getAddress());
      await ConfigurableMock.connect(owner).setConfigurer(addressZero);
      assert.equal(await ConfigurableMock.configurer(), addressZero);
      assert.equal(await ConfigurableMock.nominatedConfigurer(), addressZero);
    });
  });

  describe('allows owner to set configurer', function () {
    it('shows that the owner can call `setConfigurer`', async function () {
      await ConfigurableMock.connect(owner).setConfigurer(await configurer.getAddress());
      assert.equal(await ConfigurableMock.configurer(), await configurer.getAddress());
      assert.equal(await ConfigurableMock.nominatedConfigurer(), addressZero);
    });

    it('shows that the owner cannot set the configurer to the same address as the current configurer', async function () {
      await assertRevert(
        ConfigurableMock.connect(owner).setConfigurer(await configurer.getAddress()),
        'NoChange'
      );
    });
  });
  describe('after a configurer is set', function () {
    describe('Allows', function () {
      let receipt: TransactionReceipt;

      describe('when an non-configurer tries to nominate a new configurer', function () {
        it('reverts', async function () {
          await assertRevert(
            ConfigurableMock.connect(newConfigurer).nominateNewConfigurer(
              await newConfigurer.getAddress()
            ),
            `Unauthorized("${await newConfigurer.getAddress()}")`
          );
        });
      });

      describe('reverts if configurer nominates address 0x0 as the new configurer', function () {
        it('reverts', async function () {
          await assertRevert(
            ConfigurableMock.connect(configurer).nominateNewConfigurer(addressZero),
            'ZeroAddress'
          );
        });
      });

      before('nominateNewConfigurer', async function () {
        const tx = await ConfigurableMock.connect(configurer).nominateNewConfigurer(
          await newConfigurer.getAddress()
        );
        receipt = await tx.wait();
      });

      it('shows that the configurer address is nominated', async function () {
        assert.equal(
          await ConfigurableMock.nominatedConfigurer(),
          await newConfigurer.getAddress()
        );
      });

      it('emitted an ConfigurerNominated event', async function () {
        const evt = findEvent({ receipt, eventName: 'ConfigurerNominated' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.newConfigurer, await newConfigurer.getAddress());
      });

      describe('when attempting to re-nominate the same configurer', function () {
        it('reverts', async function () {
          await assertRevert(
            ConfigurableMock.connect(configurer).nominateNewConfigurer(
              await newConfigurer.getAddress()
            ),
            'NoChange'
          );
        });
      });

      describe('when the owner and configurer are set', function () {
        it('the owner and configurer can call functions with the onlyOwnerOrConfigurer modifier', async function () {
          assertBn.equal(await ConfigurableMock.counter(), 0);
          await ConfigurableMock.connect(owner).countUp();
          assertBn.equal(await ConfigurableMock.counter(), 1);
          await ConfigurableMock.connect(configurer).countUp();
          assertBn.equal(await ConfigurableMock.counter(), 2);
        });

        it('a user cannot call functions with the onlyOwnerOrConfigurer modifier', async function () {
          await assertRevert(ConfigurableMock.connect(user).countUp(), 'Unauthorized');
        });

        it('configurer cannot call onlyOwner functions but owner can', async function () {
          await assertRevert(ConfigurableMock.connect(configurer).setCounter(1337), 'Unauthorized');
          await ConfigurableMock.connect(owner).setCounter(1337);
          assertBn.equal(await ConfigurableMock.counter(), 1337);
        });
      });

      describe('Accepting the configurer role', function () {
        describe('when an non nominated address tries to accept the configurer role', function () {
          it('reverts', async function () {
            await assertRevert(
              ConfigurableMock.connect(owner).acceptConfigurerRole(),
              `NotNominatedAsConfigurer("${await owner.getAddress()}")`
            );
          });
        });

        describe('when the nominated address accepts the configurer role', function () {
          before('accept configurer role', async function () {
            const tx = await ConfigurableMock.connect(newConfigurer).acceptConfigurerRole();
            receipt = await tx.wait();
          });

          after('return configurer role', async function () {
            let tx;

            tx = await ConfigurableMock.connect(newConfigurer).nominateNewConfigurer(
              await configurer.getAddress()
            );
            await tx.wait();

            tx = await ConfigurableMock.connect(configurer).acceptConfigurerRole();
            await tx.wait();
          });

          it('emits an ConfigurerChanged event', async function () {
            const evt = findEvent({ receipt, eventName: 'ConfigurerChanged' });

            assert(!Array.isArray(evt) && evt?.args);
            assert.equal(evt.args.newConfigurer, await newConfigurer.getAddress());
          });

          it('shows that the address is the new configurer', async function () {
            assert.equal(await ConfigurableMock.configurer(), await newConfigurer.getAddress());
          });

          it('shows that the address is no longer nominated', async function () {
            assert.equal(await ConfigurableMock.nominatedConfigurer(), addressZero);
          });
        });
      });

      describe('Renouncing nomination', function () {
        describe('when there is no nomination', function () {
          it('reverts', async function () {
            await assertRevert(
              ConfigurableMock.connect(newConfigurer).renounceConfigurerNomination(),
              `NotNominatedAsConfigurer("${await newConfigurer.getAddress()}")`
            );
          });
        });

        describe('when there is a nomination', function () {
          before('nominateNewConfigurer', async function () {
            const tx = await ConfigurableMock.connect(configurer).nominateNewConfigurer(
              await newConfigurer.getAddress()
            );
            await tx.wait();
          });

          it('shows that the right address is nominated', async function () {
            assert.equal(
              await ConfigurableMock.nominatedConfigurer(),
              await newConfigurer.getAddress()
            );
          });

          describe('when a non nominated user tries to renounce', function () {
            it('reverts', async function () {
              await assertRevert(
                ConfigurableMock.connect(user).renounceConfigurerNomination(),
                `NotNominatedAsConfigurer("${await user.getAddress()}")`
              );
            });
          });

          describe('when the nominated configurer renounces', function () {
            before('renounce nomination', async function () {
              const tx =
                await ConfigurableMock.connect(newConfigurer).renounceConfigurerNomination();
              await tx.wait();
            });

            it('shows that there is no address nominated', async function () {
              assert.equal(await ConfigurableMock.nominatedConfigurer(), addressZero);
            });
          });
        });
      });
    });
  });
});
