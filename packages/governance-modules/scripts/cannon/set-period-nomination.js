const hre = require('hardhat');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');

async function main() {
  const proxyAddress = require(`${hre.config.paths.root}/deployments/hardhat/proxy.json`).address;
  const ElectionModule = await hre.ethers.getContractAt(
    'contracts/modules/ElectionModule.sol:ElectionModule',
    proxyAddress
  );

  // necessary on first run, if not the next fastForwardTo() call does not work.
  await hre.ethers.provider.send('evm_mine');

  await fastForwardTo(
    (await ElectionModule.getNominationPeriodStartDate()).toNumber() + 1,
    hre.ethers.provider
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
