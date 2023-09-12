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
  'base-testnet': 'base-goerli',
}[networkName];

async function run() {
  const url =
    networkName === 'base-goerli'
      ? 'https://base-goerli.infura.io/v3/' + process.env.INFURA_KEY
      : ethers.providers.InfuraProvider.getUrl(networkId, process.env.INFURA_KEY);

  const provider = new ethers.providers.JsonRpcProvider(url);

  const networks = JSON.parse(fs.readFileSync('./networks.json', 'utf8'));

  networks[graphNetworkName].SpotMarketProxy.address =
    require(`./${networkName}/deployments/SpotMarketProxy.json`).address;

  const deployTx =
    require(`./${networkName}/deployments/InitialSpotMarketProxy.json`).deployTxnHash;
  const tx = await provider.getTransactionReceipt(deployTx);
  networks[graphNetworkName].SpotMarketProxy.startBlock = tx.blockNumber;

  const prettierOptions = JSON.parse(fs.readFileSync('../../../.prettierrc', 'utf8'));

  const pretty = prettier.format(JSON.stringify(networks, null, 2), {
    parser: 'json',
    ...prettierOptions,
  });

  fs.writeFileSync('./networks.json', pretty, 'utf8');
}

run();
