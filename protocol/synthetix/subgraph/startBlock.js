#!/usr/bin/env node

const ethers = require('ethers');

async function getStartBlock({ namespace, networkName }) {
  const provider = new ethers.providers.JsonRpcProvider(
    `https://${networkName}.infura.io/v3/${process.env.INFURA_KEY}`
  );
  const address = require(`./${namespace}/deployments/CoreProxy.json`).address;
  const deployTx = require(`./${namespace}/deployments/InitialCoreProxy.json`).deployTxnHash;
  const tx = await provider.getTransactionReceipt(deployTx);
  return { namespace, networkName, address, startBlock: tx.blockNumber };
}
exports.findDeploymentBlock = getStartBlock;

async function findAll() {
  const data = await Promise.all([
    getStartBlock({ namespace: 'mainnet', networkName: 'mainnet' }),
    getStartBlock({ namespace: 'goerli', networkName: 'goerli' }),
    getStartBlock({ namespace: 'optimism-mainnet', networkName: 'optimism-mainnet' }),
    getStartBlock({ namespace: 'optimism-goerli', networkName: 'optimism-goerli' }),
    getStartBlock({ namespace: 'base-goerli', networkName: 'base-goerli' }),
    getStartBlock({ namespace: 'base-goerli-competition', networkName: 'base-goerli' }),
  ]);

  return Object.fromEntries(
    data.map(({ namespace, address, startBlock }) => [
      namespace,
      { CoreProxy: { address, startBlock } },
    ])
  );
}

if (require.main === module) {
  const [namespace, networkName] = process.argv.slice(2);
  if (namespace && networkName) {
    getStartBlock({ namespace, networkName }).then(({ address, startBlock }) =>
      console.log({ CoreProxy: { address, startBlock } })
    );
  } else {
    findAll().then((data) => console.log(data));
  }
}
