#!/usr/bin/env node

const ethers = require('ethers');
const fs = require('fs');
const prettier = require('prettier');

const [networkName] = process.argv.slice(2);

const graphNetworkName = {
  mainnet: 'mainnet',
  'optimism-mainnet': 'optimism',
  goerli: 'goerli',
  'optimism-goerli': 'optimism-goerli',
  'base-goerli': 'base-testnet',
}[networkName];

async function run() {
  const provider = new ethers.providers.JsonRpcProvider(
    `https://${networkName}.infura.io/v3/${process.env.INFURA_KEY}`
  );

  const networks = JSON.parse(fs.readFileSync('./networks.json', 'utf8'));

  networks[graphNetworkName].SpotMarketProxy.address = require(
    `./${networkName}/deployments/SpotMarketProxy.json`
  ).address;

  const deployTx = require(
    `./${networkName}/deployments/InitialSpotMarketProxy.json`
  ).deployTxnHash;
  const tx = await provider.getTransactionReceipt(deployTx);
  networks[graphNetworkName].SpotMarketProxy.startBlock = tx.blockNumber;

  const prettierOptions = JSON.parse(fs.readFileSync('../../../.prettierrc', 'utf8'));

  const pretty = await prettier.format(JSON.stringify(networks, null, 2), {
    parser: 'json',
    ...prettierOptions,
  });

  fs.writeFileSync('./networks.json', pretty, 'utf8');
}

run();
