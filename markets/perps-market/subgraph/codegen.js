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

  networks[graphNetworkName].PerpsMarketProxy.address = require(
    `./${networkName}/deployments/PerpsMarketProxy.json`
  ).address;

  const deployTx = require(`./${networkName}/deployments/InitialProxy.json`).deployTxnHash;
  const tx = await provider.getTransactionReceipt(deployTx);
  networks[graphNetworkName].PerpsMarketProxy.startBlock = tx.blockNumber;

  const prettierOptions = JSON.parse(fs.readFileSync('../../../.prettierrc', 'utf8'));

  const pretty = await prettier.format(JSON.stringify(networks, null, 2), {
    parser: 'json',
    ...prettierOptions,
  });

  fs.writeFileSync('./networks.json', pretty, 'utf8');
}

run();
