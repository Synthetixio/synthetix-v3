const ethers = require('ethers').ethers;
const CoreProxy = require('@synthetixio/v3-contracts/build/optimism-goerli/CoreProxy');

async function getCollateralConfig() {
  const provider = new ethers.providers.JsonRpcProvider('https://goerli.optimism.io');

  const coreProxy = new ethers.Contract(CoreProxy.address, CoreProxy.abi, provider);
  const collateralConfigs = await coreProxy.getCollateralConfigurations(false);
  for (const config of collateralConfigs) {
    try {
      const contract = new ethers.Contract(config.tokenAddress, ['function symbol() view returns (string)'], provider);
      const collateralSymbol = await contract.symbol();
      console.log(config);
      console.log(config.minDelegationD18.toString());
    } catch (e) {}
  }
}

getCollateralConfig();
