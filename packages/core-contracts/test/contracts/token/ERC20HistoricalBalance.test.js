const { ethers } = hre;
const { advanceBlock, getBlock } = require('@synthetixio/core-js/utils/hardhat/rpc');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');

describe('ERC20HistoricalBalance', () => {
  let ERC20;

  let user1, user2;

  before('identify signers', async () => {
    [user1, user2] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('ERC20HistoricalBalanceMock');
    ERC20 = await factory.deploy();
    const tx = await ERC20.initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();
  });

  describe('before minting any tokens', () => {
    before('set first block', async function () {
      await advanceBlock(ethers.provider);
    });

    it('the total supply is 0', async () => {
      assertBn.equal(await ERC20.totalSupply(), 0);
    });

    it('the total supply was 0', async () => {
      const currentBlock = await getBlock(ethers.provider);
      assertBn.equal(await ERC20.totalSupplyAt(currentBlock - 1), 0);
    });
  });

  describe('when tokens are minted', () => {
    let totalSupply = ethers.BigNumber.from('0');
    let receipt;

    before('initial mint for the users', async () => {
      let tx;

      tx = await ERC20.connect(user1).mint(100);
      receipt = await tx.wait();
      totalSupply = totalSupply.add(100);

      tx = await ERC20.connect(user2).mint(100);
      receipt = await tx.wait();
      totalSupply = totalSupply.add(100);
    });

    it('reads the right values', async () => {
      await advanceBlock(ethers.provider);

      assertBn.equal(await ERC20.totalSupplyAt(receipt.blockNumber), totalSupply);
      assertBn.equal(await ERC20.balanceOfAt(user1.address, receipt.blockNumber), 100);
      assertBn.equal(await ERC20.balanceOfAt(user2.address, receipt.blockNumber), 100);
    });

    describe('when getting the past values', () => {
      describe('when minting', () => {
        const initialBalances = [];
        let initialTotalSupply;
        let r1, r2, r3;

        before('read initial balances', async () => {
          initialBalances.push(await ERC20.balanceOf(user1.address));
          initialTotalSupply = await ERC20.totalSupply();
        });

        before('do some transactions', async () => {
          let tx;
          tx = await ERC20.connect(user1).mint(10);
          r1 = await tx.wait();

          tx = await ERC20.connect(user1).mint(20);
          r2 = await tx.wait();

          tx = await ERC20.connect(user1).mint(30);
          r3 = await tx.wait();
        });

        it('reads the right values', async () => {
          await advanceBlock(ethers.provider);

          assertBn.equal(await ERC20.totalSupplyAt(r1.blockNumber), initialTotalSupply.add(10));
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r1.blockNumber),
            initialBalances[0].add(10)
          );

          assertBn.equal(await ERC20.totalSupplyAt(r2.blockNumber), initialTotalSupply.add(30));
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r2.blockNumber),
            initialBalances[0].add(30)
          );

          assertBn.equal(await ERC20.totalSupplyAt(r3.blockNumber), initialTotalSupply.add(60));
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r3.blockNumber),
            initialBalances[0].add(60)
          );
        });
      });

      describe('when burning', () => {
        const initialBalances = [];
        let initialTotalSupply;
        let r1, r2, r3;

        before('read initial balances', async () => {
          initialBalances.push(await ERC20.balanceOf(user1.address));
          initialTotalSupply = await ERC20.totalSupply();
        });

        before('do some transactions', async () => {
          let tx;
          tx = await ERC20.connect(user1).burn(10);
          r1 = await tx.wait();

          tx = await ERC20.connect(user1).burn(20);
          r2 = await tx.wait();

          tx = await ERC20.connect(user1).burn(30);
          r3 = await tx.wait();
        });

        it('reads the right values', async () => {
          await advanceBlock(ethers.provider);

          assertBn.equal(await ERC20.totalSupplyAt(r1.blockNumber), initialTotalSupply.sub(10));
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r1.blockNumber),
            initialBalances[0].sub(10)
          );

          assertBn.equal(await ERC20.totalSupplyAt(r2.blockNumber), initialTotalSupply.sub(30));
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r2.blockNumber),
            initialBalances[0].sub(30)
          );

          assertBn.equal(await ERC20.totalSupplyAt(r3.blockNumber), initialTotalSupply.sub(60));
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r3.blockNumber),
            initialBalances[0].sub(60)
          );
        });
      });

      describe('when transfering', () => {
        const initialBalances = [];
        let initialTotalSupply;
        let r1, r2, r3;

        before('read initial balances', async () => {
          initialBalances.push(await ERC20.balanceOf(user1.address));
          initialBalances.push(await ERC20.balanceOf(user2.address));
          initialTotalSupply = await ERC20.totalSupply();
        });

        before('do some transactions', async () => {
          let tx;
          tx = await ERC20.connect(user2).transfer(user1.address, 10);
          r1 = await tx.wait();

          tx = await ERC20.connect(user2).transfer(user1.address, 20);
          r2 = await tx.wait();

          tx = await ERC20.connect(user2).transfer(user1.address, 30);
          r3 = await tx.wait();
        });

        it('reads the right values', async () => {
          await advanceBlock(ethers.provider);

          assertBn.equal(await ERC20.totalSupplyAt(r1.blockNumber), initialTotalSupply);
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r1.blockNumber),
            initialBalances[0].add(10)
          );
          assertBn.equal(
            await ERC20.balanceOfAt(user2.address, r1.blockNumber),
            initialBalances[1].sub(10)
          );

          assertBn.equal(await ERC20.totalSupplyAt(r2.blockNumber), initialTotalSupply);
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r2.blockNumber),
            initialBalances[0].add(30)
          );
          assertBn.equal(
            await ERC20.balanceOfAt(user2.address, r2.blockNumber),
            initialBalances[1].sub(30)
          );

          assertBn.equal(await ERC20.totalSupplyAt(r3.blockNumber), initialTotalSupply);
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r3.blockNumber),
            initialBalances[0].add(60)
          );
          assertBn.equal(
            await ERC20.balanceOfAt(user2.address, r3.blockNumber),
            initialBalances[1].sub(60)
          );
        });
      });

      describe('when looking for an intermediate blockNumber', () => {
        const initialBalances = [];
        let initialTotalSupply, intermediateTotalSupply;
        let r1, r2, ri, rn;

        before('read initial balances', async () => {
          initialBalances.push(await ERC20.balanceOf(user1.address));
          initialBalances.push(await ERC20.balanceOf(user2.address));
          initialTotalSupply = await ERC20.totalSupply();
          intermediateTotalSupply = initialTotalSupply;
        });

        before('do some transactions', async () => {
          let tx;
          tx = await ERC20.connect(user1).mint(10);
          r1 = await tx.wait();
          intermediateTotalSupply = intermediateTotalSupply.add(10);

          tx = await ERC20.connect(user1).mint(20);
          r2 = await tx.wait();
          intermediateTotalSupply = intermediateTotalSupply.add(20);

          // Do lot of transactions in between for another account and pick one
          for (let i = 0; i < 100; i++) {
            tx = await ERC20.connect(user2).mint(30);
            const rx = await tx.wait();
            if (i <= 42) {
              intermediateTotalSupply = intermediateTotalSupply.add(30);
              if (i == 42) {
                ri = rx;
              }
            }
          }

          tx = await ERC20.connect(user1).mint(30);
          rn = await tx.wait();
        });

        it('reads the right values', async () => {
          await advanceBlock(ethers.provider);

          assertBn.equal(await ERC20.totalSupplyAt(r1.blockNumber), initialTotalSupply.add(10));
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r1.blockNumber),
            initialBalances[0].add(10)
          );

          assertBn.equal(await ERC20.totalSupplyAt(r2.blockNumber), initialTotalSupply.add(30));
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, r2.blockNumber),
            initialBalances[0].add(30)
          );

          // Should be the same as r2 for user1 and the point in time for totalSupply
          assertBn.equal(await ERC20.totalSupplyAt(ri.blockNumber), intermediateTotalSupply);
          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, ri.blockNumber),
            initialBalances[0].add(30)
          );

          assertBn.equal(
            await ERC20.balanceOfAt(user1.address, rn.blockNumber),
            initialBalances[0].add(60)
          );
        });
      });
    });

    describe('when attempting to get the value from a block not yet mined', () => {
      it('reverts totalSupplyAt()', async () => {
        const blockNumber = await getBlock(ethers.provider);

        await assertRevert(
          ERC20.totalSupplyAt(blockNumber + 1),
          `BlockNumberNotYetMined(${blockNumber + 1})`
        );
      });

      it('reverts balanceOfAt()', async () => {
        const blockNumber = await getBlock(ethers.provider);

        await assertRevert(
          ERC20.balanceOfAt(user1.address, blockNumber + 1),
          `BlockNumberNotYetMined(${blockNumber + 1})`
        );
      });
    });
  });
});
