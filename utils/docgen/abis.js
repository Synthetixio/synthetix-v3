/* eslint-disable no-unused-vars */
const { inspect } = require('@usecannon/cli');
const fs = require('fs/promises');
const prettier = require('prettier');

const CHAIN_IDS = [1, 5, 10, 420, 80001, 84531, 11155111];

function noop() {}

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

function overrideStdoutWrite(callback = noop) {
  const _write = process.stdout.write;
  process.stdout.write = (...args) => callback(...args);
  return () => {
    process.stdout.write = _write;
  };
}

function overrideConsole(callback = noop) {
  const _log = console.log;
  console.log = (...args) => callback(...args);

  const _warn = console.warn;
  console.warn = (...args) => callback(...args);

  const _error = console.error;
  console.error = (...args) => callback(...args);

  return () => {
    console.log = _log;
    console.warn = _warn;
    console.error = _error;
  };
}

async function fetchDeployments(chainId) {
  const unhookStdout = overrideStdoutWrite();
  const unhookConsole = overrideConsole();
  const deployments = await inspect('synthetix-omnibus', chainId, 'main', true);
  unhookStdout();
  unhookConsole();
  return deployments;
}

async function run() {
  await fs.mkdir(`${__dirname}/abis`, { recursive: true });
  await fs.mkdir(`${__dirname}/docs`, { recursive: true });
  await fs.mkdir(`${__dirname}/deployments`, { recursive: true });
  const prettierOptions = JSON.parse(await fs.readFile(`${__dirname}/../../.prettierrc`, 'utf8'));

  const prettyJson = (obj) =>
    prettier.format(JSON.stringify(obj, null, 2), { parser: 'json', ...prettierOptions });

  for (const chainId of CHAIN_IDS) {
    console.log(`Fetching deployments for "${chainName(chainId)} - ${chainId}"`);
    const deployments = await fetchDeployments(chainId);
    if (!deployments) {
      console.log(`No deployments for "${chainName(chainId)} - ${chainId}"`);
      continue;
    }
    await fs.writeFile(`./deployments/${chainId}.json`, prettyJson(deployments), 'utf8');

    await fs.writeFile(`./docs/${chainId}.md`, `## ${chainName(chainId)}\n\n`, 'utf8');
    await fs.appendFile(`./docs/${chainId}.md`, `Chain ID: ${chainId}\n\n`, 'utf8');
    await fs.appendFile(`./docs/${chainId}.md`, '| System | Address | ABI |\n', 'utf8');
    await fs.appendFile(`./docs/${chainId}.md`, '| --- | --- | --- |\n', 'utf8');
    const system = deployments?.state?.['provision.system']?.artifacts?.imports?.system;
    if (system) {
      console.log(`Writing ${chainId}-SynthetixCore.json`);
      await fs.writeFile(
        `./abis/${chainId}-SynthetixCore.json`,
        prettyJson(system.contracts.CoreProxy),
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
        prettyJson(system.contracts.AccountProxy),
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
        prettyJson(system.contracts.USDProxy),
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
          prettyJson(oracleManager.contracts.Proxy),
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
        prettyJson(spotFactory.contracts.SpotMarketProxy),
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
        prettyJson(perpsFactory.contracts.PerpsMarketProxy),
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
        prettyJson(perpsFactory.contracts.AccountProxy),
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
      deployments?.state?.['invoke.configureSnxCollateral']?.artifacts?.txns
        ?.configureSnxCollateral;
    const [snxCollateralConfiguredEvent] =
      configureSnxCollateral?.events?.CollateralConfigured ?? [];
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
  console.log('OK');
}

run();
