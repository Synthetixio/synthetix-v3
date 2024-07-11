#!/usr/bin/env node

const ethers = require('ethers');

async function getStartBlock({ namespace, networkName }) {
  const provider = new ethers.providers.JsonRpcProvider(
    `https://${networkName}.infura.io/v3/${process.env.INFURA_KEY}`
  );
  const address = require(`./${namespace}/deployments/system/CoreProxy.json`).address;
  const deployTx = require(`./${namespace}/deployments/system/InitialCoreProxy.json`).deployTxnHash;
  const tx = await provider.getTransactionReceipt(deployTx);
  return { namespace, networkName, address, startBlock: tx.blockNumber };
}
exports.findDeploymentBlock = getStartBlock;

async function findAll() {
  const data = await Promise.all([
    getStartBlock({ namespace: 'mainnet', networkName: 'mainnet' }),
    getStartBlock({ namespace: 'sepolia', networkName: 'sepolia' }),
    getStartBlock({ namespace: 'optimism-mainnet', networkName: 'optimism-mainnet' }),
    // getStartBlock({ namespace: 'optimism-sepolia', networkName: 'optimism-sepolia' }),
    getStartBlock({ namespace: 'base-sepolia-andromeda', networkName: 'base-sepolia' }),
    getStartBlock({ namespace: 'base-mainnet-andromeda', networkName: 'base-mainnet' }),
    getStartBlock({ namespace: 'arbitrum-mainnet', networkName: 'arbitrum-mainnet' }),
    getStartBlock({ namespace: 'arbitrum-sepolia', networkName: 'arbitrum-sepolia' }),
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
