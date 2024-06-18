#!/usr/bin/env node

const ethers = require('ethers');

async function getStartBlock({ namespace, networkName }) {
  const provider = new ethers.providers.JsonRpcProvider(
    `https://${networkName}.infura.io/v3/${process.env.INFURA_KEY}`
  );
  const address = require(`./${namespace}/deployments/perpsFactory/PerpsMarketProxy.json`).address;
  const deployTx = require(
    `./${namespace}/deployments/perpsFactory/InitialProxy.json`
  ).deployTxnHash;
  const tx = await provider.getTransactionReceipt(deployTx);
  return { namespace, networkName, address, startBlock: tx.blockNumber };
}
exports.findDeploymentBlock = getStartBlock;

async function findAll() {
  const data = await Promise.all([
    getStartBlock({ namespace: 'optimism-goerli', networkName: 'optimism-goerli' }),
    getStartBlock({ namespace: 'base-mainnet-andromeda', networkName: 'base-mainnet' }),
    getStartBlock({ namespace: 'base-sepolia-andromeda', networkName: 'base-sepolia' }),
  ]);

  return Object.fromEntries(
    data.map(({ namespace, address, startBlock }) => [
      namespace,
      { PerpsMarketProxy: { address, startBlock } },
    ])
  );
}

if (require.main === module) {
  const [namespace, networkName] = process.argv.slice(2);
  if (namespace && networkName) {
    getStartBlock({ namespace, networkName }).then(({ address, startBlock }) =>
      console.log({ PerpsMarketProxy: { address, startBlock } })
    );
  } else {
    findAll().then((data) => console.log(data));
  }
}
