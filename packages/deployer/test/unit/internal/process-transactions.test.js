const { equal, deepStrictEqual } = require('assert/strict');
const { processTransaction } = require('../../../internal/process-transactions');
const { loadEnvironment } = require('../../helpers/use-environment');

describe.only('internal/process-transactions.js', function () {
  let signer;

  let transaction;
  let receipt;

  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('custom-proxy');
  });

  beforeEach('identify signers', async function () {
    signer = (await hre.ethers.getSigners())[0];
  });

  beforeEach('mock deployment data', async function () {
    hre.deployer = {
      deployment: {
        general: {
          transactions: {},
          properties: {
            totalGasUsed: 0,
          },
        },
      },
    };
  });

  describe('before sending a transaction', function () {
    it('shows txs list empty', async function () {
      deepStrictEqual(hre.deployer.deployment.general.transactions, {});
    });

    describe('when trying to send a tx that fails', async function () {
      beforeEach('send a failing tx', async function ()  {
        transaction = await signer.sendTransaction({
          to: '0x0000000000000000000000000000000000000000',
        });

        await processTransaction(transaction, hre);
      });

      it('registers a transaction in the deployment data', async function () {
        equal(
          hre.deployer.deployment.general.transactions[transaction.hash].status,
          'failed'
        );
      });
    });

    describe('when sending a transaction', function () {
      beforeEach('send a tx', async function () {
        transaction = await signer.sendTransaction({
          to: '0x0000000000000000000000000000000000000000',
        });

        receipt = await processTransaction(transaction, hre);
      });

      it('registers a transaction in the deployment data', async function () {
        equal(
          hre.deployer.deployment.general.transactions[transaction.hash].status,
          'confirmed'
        );
      });

      it('returns a valid receipt', async function () {
        equal(receipt.from, signer.address);
      });

      it('records total gas used', async function () {
        equal(
          receipt.gasUsed.toString(),
          hre.deployer.deployment.general.properties.totalGasUsed
        );
      });
    });
  });
});
