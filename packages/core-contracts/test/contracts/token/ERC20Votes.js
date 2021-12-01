const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assert-bignumber');

describe('ERC20Votes', () => {
  let ERC20;

  let user1, user2;

  before('identify signers', async () => {
    [user1, user2] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('ERC20VotesMock');
    ERC20 = await factory.deploy();
    const tx = await ERC20.initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();
  });

  describe('when tokens are minted', () => {
    const totalSupply = ethers.BigNumber.from('1000000');

    before('mint', async () => {
      const tx = await ERC20.connect(user1).mint(totalSupply);
      await tx.wait();
    });

    it('updates the voting power', async () => {
      assertBn.eq(await ERC20.getVotes(user1.address), totalSupply);
    });

    describe('when tokens are burned', () => {
      const tokensToBurn = ethers.BigNumber.from('1000');
      const newSupply = totalSupply.sub(tokensToBurn);

      before('burn', async () => {
        const tx = await ERC20.connect(user1).burn(tokensToBurn);
        await tx.wait();
      });

      it('reduces the user voting power', async () => {
        assertBn.eq(await ERC20.getVotes(user1.address), newSupply);
      });
    });

    describe('transfer()', () => {
      const transferAmount = ethers.BigNumber.from('10');
      let currentSupply, user1Votes, user2Votes;

      before('record votes and supply', async () => {
        currentSupply = await ERC20.totalSupply();
        user1Votes = await ERC20.getVotes(user1.address);
        user2Votes = await ERC20.getVotes(user2.address);
      });

      describe('when having enough balance', () => {
        before('transfer', async () => {
          const tx = await ERC20.connect(user1).transfer(user2.address, transferAmount);
          await tx.wait();
        });

        it('does not alter the total supply', async () => {
          assertBn.eq(await ERC20.totalSupply(), currentSupply);
        });

        it('reduces the sender votes and increases the receiver votes', async () => {
          assertBn.eq(await ERC20.getVotes(user1.address), user1Votes.sub(transferAmount));
          assertBn.eq(await ERC20.getVotes(user2.address), user2Votes.add(transferAmount));
        });
      });
    });
  });
});
