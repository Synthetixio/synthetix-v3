#!/usr/bin/env node

const fs = require('fs/promises');
const prettier = require('prettier');

const [chainIdString, deploymentsFile] = process.argv.slice(2);
if (!chainIdString || !deploymentsFile) {
  console.log('Usage: node ./abis.js <CHAIN_ID> <DEPLOYMENTS_JSON>');
  console.log('  example: node ./abis.js 1 ./deployments/1.json');
  process.exit(1);
}
const chainId = parseInt(chainIdString, 10);
const deployments = require(deploymentsFile);

//const CHAIN_IDS = [1, 5, 10, 420, 80001, 84531, 11155111];

function etherscanLink(chain, address) {
  switch (chain) {
    case 1:
      return `https://etherscan.io/address/${address}`;
    case 5:
      return `https://goerli.etherscan.io/address/${address}`;
    case 11155111:
      return `https://sepolia.etherscan.io/address/${address}`;
    case 10:
      return `https://optimistic.etherscan.io/address/${address}`;
    case 420:
      return `https://goerli-optimism.etherscan.io/address/${address}`;
    case 80001:
      return `https://mumbai.polygonscan.com/address/${address}`;
    case 84531:
      return `https://goerli.basescan.org/address/${address}`;
  }
}

function chainName(chain) {
  switch (chain) {
    case 1:
      return 'Mainnet';
    case 5:
      return 'Goerli';
    case 11155111:
      return 'Sepolia';
    case 10:
      return 'Optimism';
    case 420:
      return 'Optimistic Goerli';
    case 80001:
      return 'Polygon Mumbai';
    case 84531:
      return 'Base Goerli';
  }
}

async function run() {
  await fs.mkdir(`${__dirname}/abis`, { recursive: true });
  await fs.mkdir(`${__dirname}/docs`, { recursive: true });

  const prettierOptions = JSON.parse(await fs.readFile(`${__dirname}/../../.prettierrc`, 'utf8'));
  const prettyJson = async (obj) =>
    await prettier.format(JSON.stringify(obj, null, 2), { parser: 'json', ...prettierOptions });

  await fs.writeFile(`./docs/${chainId}.md`, `## ${chainName(chainId)}\n\n`, 'utf8');
  await fs.appendFile(`./docs/${chainId}.md`, `Chain ID: ${chainId}\n\n`, 'utf8');
  await fs.appendFile(`./docs/${chainId}.md`, '| System | Address | ABI |\n', 'utf8');
  await fs.appendFile(`./docs/${chainId}.md`, '| --- | --- | --- |\n', 'utf8');
  const system = deployments?.state?.['provision.system']?.artifacts?.imports?.system;
  if (system) {
    console.log(`Writing ${chainId}-SynthetixCore.json`);
    await fs.writeFile(
      `./abis/${chainId}-SynthetixCore.json`,
      await prettyJson(system.contracts.CoreProxy),
      'utf8'
    );
    await fs.appendFile(
      `./docs/${chainId}.md`,
      `| Synthetix Core | [${system.contracts.CoreProxy.address}](${etherscanLink(
        chainId,
        system.contracts.CoreProxy.address
      )}) | [View/Download](./abis/${chainId}-SynthetixCore.json) |\n`,
      'utf8'
    );

    console.log(`Writing ${chainId}-snxAccountNFT.json`);
    await fs.writeFile(
      `./abis/${chainId}-snxAccountNFT.json`,
      await prettyJson(system.contracts.AccountProxy),
      'utf8'
    );
    await fs.appendFile(
      `./docs/${chainId}.md`,
      `| snxAccount NFT | [${system.contracts.AccountProxy.address}](${etherscanLink(
        chainId,
        system.contracts.AccountProxy.address
      )}) | [View/Download](./abis/${chainId}-snxAccountNFT.json) |\n`,
      'utf8'
    );

    console.log(`Writing ${chainId}-snxUSDToken.json`);
    await fs.writeFile(
      `./abis/${chainId}-snxUSDToken.json`,
      await prettyJson(system.contracts.USDProxy),
      'utf8'
    );
    await fs.appendFile(
      `./docs/${chainId}.md`,
      `| snxUSD Token | [${system.contracts.USDProxy.address}](${etherscanLink(
        chainId,
        system.contracts.USDProxy.address
      )}) | [View/Download](./abis/${chainId}-snxUSDToken.json) |\n`,
      'utf8'
    );

    const { oracle_manager: oracleManager } = system.imports;
    if (oracleManager) {
      console.log(`Writing ${chainId}-OracleManager.json`);
      await fs.writeFile(
        `./abis/${chainId}-OracleManager.json`,
        await prettyJson(oracleManager.contracts.Proxy),
        'utf8'
      );
      await fs.appendFile(
        `./docs/${chainId}.md`,
        `| Oracle Manager | [${oracleManager.contracts.Proxy.address}](${etherscanLink(
          chainId,
          oracleManager.contracts.Proxy.address
        )}) | [View/Download](./abis/${chainId}-OracleManager.json) |\n`,
        'utf8'
      );
    }
  }

  const spotFactory =
    deployments?.state?.['provision.spotFactory']?.artifacts?.imports?.spotFactory;
  if (spotFactory) {
    console.log(`Writing ${chainId}-SpotMarket.json`);
    await fs.writeFile(
      `./abis/${chainId}-SpotMarket.json`,
      await prettyJson(spotFactory.contracts.SpotMarketProxy),
      'utf8'
    );
    await fs.appendFile(
      `./docs/${chainId}.md`,
      `| Spot Market | [${spotFactory.contracts.SpotMarketProxy.address}](${etherscanLink(
        chainId,
        spotFactory.contracts.SpotMarketProxy.address
      )}) | [View/Download](./abis/${chainId}-SpotMarket.json) |\n`,
      'utf8'
    );
  }

  const perpsFactory =
    deployments?.state?.['provision.perpsFactory']?.artifacts?.imports?.perpsFactory;
  if (perpsFactory) {
    console.log(`Writing ${chainId}-PerpsMarket.json`);
    await fs.writeFile(
      `./abis/${chainId}-PerpsMarket.json`,
      await prettyJson(perpsFactory.contracts.PerpsMarketProxy),
      'utf8'
    );
    await fs.appendFile(
      `./docs/${chainId}.md`,
      `| Perps Market | [${perpsFactory.contracts.PerpsMarketProxy.address}](${etherscanLink(
        chainId,
        perpsFactory.contracts.PerpsMarketProxy.address
      )}) | [View/Download](./abis/${chainId}-PerpsMarket.json) |\n`,
      'utf8'
    );

    console.log(`Writing ${chainId}-PerpsAccountNFT.json`);
    await fs.writeFile(
      `./abis/${chainId}-PerpsAccountNFT.json`,
      await prettyJson(perpsFactory.contracts.AccountProxy),
      'utf8'
    );
    await fs.appendFile(
      `./docs/${chainId}.md`,
      `| Perps Market Account NFT | [${
        perpsFactory.contracts.AccountProxy.address
      }](${etherscanLink(
        chainId,
        perpsFactory.contracts.AccountProxy.address
      )}) | [View/Download](./abis/${chainId}-PerpsAccountNFT.json) |\n`,
      'utf8'
    );
  }

  console.log(`Writing ${chainId}.md`);
  // SNX token
  const configureSnxCollateral =
    deployments?.state?.['invoke.configureSnxCollateral']?.artifacts?.txns?.configureSnxCollateral;
  const [snxCollateralConfiguredEvent] = configureSnxCollateral?.events?.CollateralConfigured ?? [];
  const [snxAddress] = snxCollateralConfiguredEvent?.args ?? [];
  if (snxAddress) {
    await fs.appendFile(
      `./docs/${chainId}.md`,
      `| SNX Token | [${snxAddress}](${etherscanLink(
        chainId,
        snxAddress
      )}) | _ERC-20 compliant_ |\n`,
      'utf8'
    );
  }
}

run();
