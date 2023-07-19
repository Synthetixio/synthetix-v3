/* eslint-disable no-unused-vars */
const { inspect } = require('@usecannon/cli');
const fs = require('fs/promises');
const prettier = require('prettier');

const CHAIN_IDS = [1, 5, 10, 420, 84531, 11155111];
const PROXIES = {
  CoreProxy: 'SynthetixCore',
  AccountProxyCore: 'snxAccountNFT',
  AccountProxyPerps: 'PerpsAccountNFT',
  Proxy: 'OracleManager',
  USDProxy: 'snxUSDToken',
  SpotMarketProxy: 'SpotMarket',
  PerpsMarketProxy: 'PerpsMarket',
};

function deepFind(obj, key) {
  if (key in obj) return obj[key];

  for (let i = 0; i < Object.keys(obj).length; i++) {
    if (typeof obj[Object.keys(obj)[i]] === 'object') {
      let result = deepFind(obj[Object.keys(obj)[i]], key);
      if (result) return result;
    }
  }

  return null;
}

function noop() {}

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

async function run() {
  await fs.mkdir(`${__dirname}/abis`, { recursive: true });
  const prettierOptions = JSON.parse(await fs.readFile(`${__dirname}/../../.prettierrc`, 'utf8'));

  for (const chainId of CHAIN_IDS) {
    const unhookStdout = overrideStdoutWrite();
    const unhookConsole = overrideConsole();
    const jsonOutput = await inspect('synthetix-omnibus', chainId, 'main', true);
    unhookStdout();
    unhookConsole();

    const files = Object.entries(PROXIES)
      .map(([proxyKey, proxyName]) => {
        if (proxyKey.startsWith('AccountProxy')) {
          const getCoreAccountProxy = proxyKey === 'AccountProxyCore';
          const specificJsonOutput = getCoreAccountProxy
            ? jsonOutput.state['provision.system']
            : jsonOutput.state['provision.perpsFactory']?.artifacts?.imports?.perpsFactory;
          if (specificJsonOutput) {
            const abi = deepFind(specificJsonOutput, 'AccountProxy');
            if (abi) {
              return { chainId, proxyKey, proxyName, abi };
            }
          }
        } else {
          const abi = deepFind(jsonOutput, proxyKey);
          if (abi) {
            return { chainId, proxyKey, proxyName, abi };
          }
        }
      })
      .filter(Boolean);

    for (const { chainId, proxyName, abi } of files) {
      const filename = `./abis/${chainId}-${proxyName}.json`;
      console.log('Writing', filename);
      await fs.writeFile(
        filename,
        prettier.format(JSON.stringify(abi, null, 2), {
          parser: 'json',
          ...prettierOptions,
        }),
        'utf8'
      );
    }
  }
  console.log('OK');
}

run();
