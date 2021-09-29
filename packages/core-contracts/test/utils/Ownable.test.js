const { ethers } = hre;
const assert = require('assert/strict');

const { ZERO_ADDRESS } = require('../test-libs/test-lib');

describe('Ownable', () => {
  describe('Constructor / Deployment', () => {
    it('Should revert when no argument passed to Ctor', async () => {
      const OwnableParent = await ethers.getContractFactory('OwnableParent');

      await assert.rejects(
        async () => {
          await OwnableParent.deploy();
        },
        {
          name: 'Error',
          message:
            `missing argument:  in Contract constructor (count=0,` +
            ` expectedCount=1, code=MISSING_ARGUMENT, version=contracts/5.4.1)`,
        }
      );
    });

    it('Should revert when owner parameter is passed the zero address', async () => {
      const OwnableParent = await ethers.getContractFactory('OwnableParent');

      await assert.rejects(
        async () => {
          await OwnableParent.deploy(ZERO_ADDRESS);
        },
        {
          name: 'Error',
          message:
            `VM Exception while processing transaction: reverted with` +
            ` reason string 'Owner address cannot be 0x0'`,
        }
      );
    });

    it('Should set owner address on deployment', async () => {
      const [owner] = await ethers.getSigners();
      const OwnableParent = await ethers.getContractFactory('OwnableParent');
      const ownableParent = await OwnableParent.deploy(owner.address);
      await ownableParent.deployed();

      const contractOwner = await ownableParent.owner();

      assert.equal(contractOwner, owner.address);
    });

    it('Should trigger OwnerChanged event on deployment', async () => {
      const [owner] = await ethers.getSigners();
      const OwnableParent = await ethers.getContractFactory('OwnableParent');
      const ownableParent = await OwnableParent.deploy(owner.address);
      await ownableParent.deployed();

      await new Promise((resolve) => {
        ownableParent.once('OwnerChanged', (oldOwner, newOwner) => {
          assert.equal(oldOwner, ZERO_ADDRESS);
          assert.equal(newOwner, owner.address);
          resolve();
        });
      });
    });
  });
  describe('Inhereted onlyOwner functionality', () => {
    beforeEach(async () => {
      const [owner, address1] = await ethers.getSigners();
      const OwnableParent = await ethers.getContractFactory('OwnableParent');
      const ownableParent = await OwnableParent.deploy(owner.address);
      await ownableParent.deployed();

      this.address1 = address1;
      this.owner = owner;
      this.ownableParent = ownableParent;
    });

    it('Should allow owner to execute sum()', async () => {
      const res = await this.ownableParent.sum(1, 1);
      assert.equal(res.toString(), '2');
    });
    it('Should not allow other address to execute sum()', async () => {
      await assert.rejects(
        async () => {
          await this.ownableParent.connect(this.address1).sum(1, 1);
        },
        {
          name: 'Error',
          message:
            `VM Exception while processing transaction: reverted with` +
            ` reason string 'Must be the contract owner'`,
        }
      );
    });
  });
  describe('Inhereted nominateNewOwner() functionality', () => {
    beforeEach(async () => {
      const [owner, address1] = await ethers.getSigners();
      const OwnableParent = await ethers.getContractFactory('OwnableParent');
      const ownableParent = await OwnableParent.deploy(owner.address);
      await ownableParent.deployed();

      this.address1 = address1;
      this.owner = owner;
      this.ownableParent = ownableParent;
    });
    it('Should allow owner to execute nominateNewOwner()', async () => {
      await this.ownableParent.nominateNewOwner(this.address1.address);
    });
    it('Should trigger OwnerNominated event on nominateNewOwner()', async () => {
      await this.ownableParent.nominateNewOwner(this.address1.address);
      await new Promise((resolve) => {
        this.ownableParent.once('OwnerNominated', (newOwner) => {
          assert.equal(newOwner, this.address1.address);
          resolve();
        });
      });
    });
    it('Should allow owner to execute onlyOwner fn after nominateNewOwner()', async () => {
      await this.ownableParent.nominateNewOwner(this.address1.address);
      const res = await this.ownableParent.sum(1, 1);
      assert.equal(res.toString(), '2');
    });
    it('Should not allow newOwner to execute onlyOwner fn after nominateNewOwner()', async () => {
      await this.ownableParent.nominateNewOwner(this.address1.address);

      await assert.rejects(
        async () => {
          await this.ownableParent.connect(this.address1).sum(1, 1);
        },
        {
          name: 'Error',
          message:
            `VM Exception while processing transaction: reverted with` +
            ` reason string 'Must be the contract owner'`,
        }
      );
    });
  });

  describe('Inhereted acceptOwnership() functionality', () => {
    beforeEach(async () => {
      const [owner, address1] = await ethers.getSigners();
      const OwnableParent = await ethers.getContractFactory('OwnableParent');
      const ownableParent = await OwnableParent.deploy(owner.address);
      await ownableParent.deployed();
      await ownableParent.nominateNewOwner(address1.address);

      this.address1 = address1;
      this.owner = owner;
      this.ownableParent = ownableParent;
    });
    it('Should allow new owner to execute acceptOwnership()', async () => {
      await this.ownableParent.connect(this.address1).acceptOwnership();
    });
    it('Should trigger OwnerChanged event on acceptOwnership()', async () => {
      await this.ownableParent.connect(this.address1).acceptOwnership();

      let eventCalls = 0;
      await new Promise((resolve) => {
        this.ownableParent.on('OwnerChanged', (oldOwner, newOwner) => {
          // Only interested in the second event, first one belongs to Ctor.
          eventCalls += 1;
          if (eventCalls < 2) {
            return;
          }

          assert.equal(oldOwner, this.owner.address);
          assert.equal(newOwner, this.address1.address);
          this.ownableParent.removeAllListeners();
          resolve();
        });
      });
    });
    it('Should allow new owner to execute onlyOwner fn after acceptOwnership()', async () => {
      await this.ownableParent.connect(this.address1).acceptOwnership();
      const res = await this.ownableParent.connect(this.address1).sum(1, 1);
      assert.equal(res.toString(), '2');
    });
    it('Should not allow old owner to execute onlyOwner fn after acceptOwnership()', async () => {
      await this.ownableParent.connect(this.address1).acceptOwnership();

      await assert.rejects(
        async () => {
          await this.ownableParent.sum(1, 1);
        },
        {
          name: 'Error',
          message:
            `VM Exception while processing transaction: reverted with` +
            ` reason string 'Must be the contract owner'`,
        }
      );
    });
  });
});
