#!/usr/bin/env node

const ethers = require('ethers');
const fs = require('fs');
const prettier = require('prettier');

const [networkName] = process.argv.slice(2);
const networkId = {
  mainnet: 1,
  'optimism-mainnet': 10,
  goerli: 5,
  'optimism-goerli': 420,
}[networkName];

const graphNetworkName = {
  mainnet: 'mainnet',
  'optimism-mainnet': 'optimism',
  goerli: 'goerli',
  'optimism-goerli': 'optimism-goerli',
}[networkName];

async function run() {
  const provider = new ethers.providers.InfuraProvider(networkId, process.env.INFURA_KEY);

  const networks = JSON.parse(fs.readFileSync('./networks.json', 'utf8'));

  networks[graphNetworkName].CoreProxy.address =
    require(`@synthetixio/v3-contracts/deployments/${networkName}/CoreProxy.json`).address;

  const deployTx =
    require(`@synthetixio/v3-contracts/deployments/${networkName}/InitialCoreProxy.json`).deployTxnHash;
  const tx = await provider.getTransactionReceipt(deployTx);
  networks[graphNetworkName].CoreProxy.startBlock = tx.blockNumber;

  const prettierOptions = JSON.parse(fs.readFileSync('../.prettierrc', 'utf8'));

  const pretty = prettier.format(JSON.stringify(networks, null, 2), {
    parser: 'json',
    ...prettierOptions,
  });

  fs.writeFileSync('./networks.json', pretty, 'utf8');
}

run();
