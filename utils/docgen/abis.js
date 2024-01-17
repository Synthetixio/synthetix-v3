#!/usr/bin/env node

const fs = require('fs/promises');
const prettier = require('prettier');
const { OnChainRegistry, IPFSLoader } = require('@usecannon/builder');

const DEFAULT_REGISTRY_ADDRESS = '0x8E5C7EFC9636A6A0408A46BB7F617094B81e5dba';

const [chainIdString, preset] = process.argv.slice(2);
if (!chainIdString || !preset) {
  console.log('Usage: node ./abis.js <CHAIN_ID> <PRESET>');
  console.log('  example: node ./abis.js 1 main');
  process.exit(1);
}
const chainId = parseInt(chainIdString, 10);
// const deployments = require(deploymentsFile);

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
    case 8453:
      return `https://basescan.org/address/${address}`;
    case 84531:
      return `https://goerli.basescan.org/address/${address}`;
  }
}

const prettierOptions = {
  printWidth: 100,
  semi: true,
  singleQuote: true,
  bracketSpacing: true,
  trailingComma: 'es5',
};

async function prettyJson(obj) {
  return await prettier.format(JSON.stringify(obj, null, 2), {
    parser: 'json',
    ...prettierOptions,
  });
}

async function prettyMd(md) {
  return await prettier.format(md, { parser: 'markdown', ...prettierOptions });
}

async function run() {
  await fs.mkdir(`${__dirname}/deployments`, { recursive: true });
  await fs.mkdir(`${__dirname}/abis`, { recursive: true });
  await fs.mkdir(`${__dirname}/docs`, { recursive: true });

  const registry = new OnChainRegistry({
    signerOrProvider: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    address: DEFAULT_REGISTRY_ADDRESS,
  });
  const loader = new IPFSLoader('https://ipfs.synthetix.io');

  const ipfs = await registry.getUrl(`synthetix-omnibus:latest@${preset}`, chainId);
  const deployments = await loader.read(ipfs);
  await fs.writeFile(
    `./deployments/${chainId}-${preset}.json`,
    JSON.stringify(deployments, null, 2)
  );

  const out = [];

  out.push(`Chain ID: ${chainId}`);
  out.push('');

  out.push('| System | Address | ABI |');
  out.push('| --- | --- | --- |');
  const system = deployments?.state?.['provision.system']?.artifacts?.imports?.system;
  if (system) {
    console.log(`Writing ${chainId}-${preset}-SynthetixCore.json`);
    await fs.writeFile(
      `./abis/${chainId}-${preset}-SynthetixCore.json`,
      await prettyJson(system.contracts.CoreProxy)
    );
    out.push(
      `| Synthetix Core | [${system.contracts.CoreProxy.address}](${etherscanLink(
        chainId,
        system.contracts.CoreProxy.address
      )}) | [View/Download](./abis/${chainId}-${preset}-SynthetixCore.json) |`
    );

    console.log(`Writing ${chainId}-${preset}-snxAccountNFT.json`);
    await fs.writeFile(
      `./abis/${chainId}-${preset}-snxAccountNFT.json`,
      await prettyJson(system.contracts.AccountProxy)
    );
    out.push(
      `| snxAccount NFT | [${system.contracts.AccountProxy.address}](${etherscanLink(
        chainId,
        system.contracts.AccountProxy.address
      )}) | [View/Download](./abis/${chainId}-${preset}-snxAccountNFT.json) |`
    );

    console.log(`Writing ${chainId}-${preset}-snxUSDToken.json`);
    await fs.writeFile(
      `./abis/${chainId}-${preset}-snxUSDToken.json`,
      await prettyJson(system.contracts.USDProxy)
    );
    out.push(
      `| snxUSD Token | [${system.contracts.USDProxy.address}](${etherscanLink(
        chainId,
        system.contracts.USDProxy.address
      )}) | [View/Download](./abis/${chainId}-${preset}-snxUSDToken.json) |`
    );

    const { oracle_manager: oracleManager } = system.imports;
    if (oracleManager) {
      console.log(`Writing ${chainId}-${preset}-OracleManager.json`);
      await fs.writeFile(
        `./abis/${chainId}-${preset}-OracleManager.json`,
        await prettyJson(oracleManager.contracts.Proxy)
      );
      out.push(
        `| Oracle Manager | [${oracleManager.contracts.Proxy.address}](${etherscanLink(
          chainId,
          oracleManager.contracts.Proxy.address
        )}) | [View/Download](./abis/${chainId}-${preset}-OracleManager.json) |`
      );
    }
  }

  const spotFactory =
    deployments?.state?.['provision.spotFactory']?.artifacts?.imports?.spotFactory;
  if (spotFactory) {
    console.log(`Writing ${chainId}-${preset}-SpotMarket.json`);
    await fs.writeFile(
      `./abis/${chainId}-${preset}-SpotMarket.json`,
      await prettyJson(spotFactory.contracts.SpotMarketProxy)
    );
    out.push(
      `| Spot Market | [${spotFactory.contracts.SpotMarketProxy.address}](${etherscanLink(
        chainId,
        spotFactory.contracts.SpotMarketProxy.address
      )}) | [View/Download](./abis/${chainId}-${preset}-SpotMarket.json) |`
    );
  }

  const perpsFactory =
    deployments?.state?.['provision.perpsFactory']?.artifacts?.imports?.perpsFactory;
  if (perpsFactory) {
    console.log(`Writing ${chainId}-${preset}-PerpsMarket.json`);
    await fs.writeFile(
      `./abis/${chainId}-${preset}-PerpsMarket.json`,
      await prettyJson(perpsFactory.contracts.PerpsMarketProxy)
    );
    out.push(
      `| Perps Market | [${perpsFactory.contracts.PerpsMarketProxy.address}](${etherscanLink(
        chainId,
        perpsFactory.contracts.PerpsMarketProxy.address
      )}) | [View/Download](./abis/${chainId}-${preset}-PerpsMarket.json) |`
    );

    console.log(`Writing ${chainId}-${preset}-PerpsAccountNFT.json`);
    const PerpsAccountNFT =
      perpsFactory.contracts.PerpsAccountProxy ?? perpsFactory.contracts.AccountProxy;

    await fs.writeFile(
      `./abis/${chainId}-${preset}-PerpsAccountNFT.json`,
      await prettyJson(PerpsAccountNFT)
    );
    out.push(
      `| Perps Market Account NFT | [${PerpsAccountNFT.address}](${etherscanLink(
        chainId,
        PerpsAccountNFT.address
      )}) | [View/Download](./abis/${chainId}-${preset}-PerpsAccountNFT.json) |`
    );
  }

  async function mintableToken(provisionStep) {
    const fakeCollateral =
      deployments?.state?.[`provision.${provisionStep}`]?.artifacts?.imports?.[provisionStep];
    const fakeCollateralOptions = deployments?.def?.provision?.[provisionStep]?.options;
    if (fakeCollateral && fakeCollateralOptions) {
      console.log(
        `Writing ${chainId}-${preset}-FakeCollateral${fakeCollateralOptions.symbol}.json`
      );
      await fs.writeFile(
        `./abis/${chainId}-${preset}-FakeCollateral${fakeCollateralOptions.symbol}.json`,
        await prettyJson(fakeCollateral.contracts.MintableToken)
      );
      out.push(
        `| Fake Collateral ${fakeCollateralOptions.symbol} ${fakeCollateralOptions.name} | [${
          fakeCollateral.contracts.MintableToken.address
        }](${etherscanLink(
          chainId,
          fakeCollateral.contracts.MintableToken.address
        )}) | [View/Download](./abis/${chainId}-${preset}-FakeCollateral${
          fakeCollateralOptions.symbol
        }.json) |`
      );
    }
  }

  await mintableToken('usdc_mock_collateral');
  await mintableToken('mintableToken');

  // Real SNX token
  const configureSnxCollateral =
    deployments?.state?.['invoke.configureSnxCollateral']?.artifacts?.txns?.configureSnxCollateral;
  const [snxCollateralConfiguredEvent] = configureSnxCollateral?.events?.CollateralConfigured ?? [];
  const [snxAddress] = snxCollateralConfiguredEvent?.args ?? [];
  if (snxAddress) {
    out.push(
      `| SNX Token | [${snxAddress}](${etherscanLink(chainId, snxAddress)}) | _ERC-20 compliant_ |`
    );
  }

  console.log(`Writing ${chainId}-${preset}.md`);
  //  await fs.writeFile(`./docs/${chainId}-${preset}.md`, out.join('\n'), );
  await fs.writeFile(`./docs/${chainId}-${preset}.md`, await prettyMd(out.join('\n')));
}

run();
