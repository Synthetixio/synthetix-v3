#!/usr/bin/env node

const ethers = require('ethers');
const fs = require('fs');
const prettier = require('prettier');

const [networkName] = process.argv.slice(2);

async function run() {
  const provider = new ethers.providers.InfuraProvider(networkName, process.env.INFURA_KEY);

  const networks = JSON.parse(fs.readFileSync('./networks.json', 'utf8'));

  networks[networkName].CoreProxy.address =
    require(`@synthetixio/v3-contracts/deployments/${networkName}/CoreProxy.json`).address;

  const deployTx =
    require(`@synthetixio/v3-contracts/deployments/${networkName}/InitialCoreProxy.json`).deployTxnHash;
  const tx = await provider.getTransactionReceipt(deployTx);
  networks[networkName].CoreProxy.startBlock = tx.blockNumber;

  const prettierOptions = JSON.parse(fs.readFileSync('../../.prettierrc', 'utf8'));

  const pretty = prettier.format(JSON.stringify(networks, null, 2), {
    parser: 'json',
    ...prettierOptions,
  });

  fs.writeFileSync('./networks.json', pretty, 'utf8');
}

run();
