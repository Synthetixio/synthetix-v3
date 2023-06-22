const { inspect } = require('@usecannon/cli');
const fs = require('fs');

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

fs.mkdirSync('./abis', { recursive: true });

CHAIN_IDS.forEach(async (chain_id) => {
  let jsonOutput = await inspect('synthetix-omnibus', chain_id, 'main', true);

  Object.keys(PROXIES).forEach((proxy) => {
    if (proxy.startsWith('AccountProxy')) {
      const getCoreAccountProxy = proxy === 'AccountProxyCore';
      const specificJsonOutput = getCoreAccountProxy
        ? jsonOutput.state['provision.system']
        : jsonOutput.state['provision.perpsFactory']?.artifacts?.imports?.perpsFactory;
      if (specificJsonOutput) {
        let value = deepFind(specificJsonOutput, 'AccountProxy');
        if (value) {
          fs.writeFileSync(
            `./abis/${chain_id}-${PROXIES[proxy]}.json`,
            JSON.stringify(value, null, 2)
          );
        }
      }
    } else {
      let value = deepFind(jsonOutput, proxy);
      if (value) {
        fs.writeFileSync(
          `./abis/${chain_id}-${PROXIES[proxy]}.json`,
          JSON.stringify(value, null, 2)
        );
      }
    }
  });
});

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
