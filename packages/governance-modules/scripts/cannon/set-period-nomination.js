const hre = require('hardhat');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');

async function main() {
  const proxyAddress = require('../../deployments/hardhat/proxy.json').address;
  const ElectionModule = await hre.ethers.getContractAt(
    'contracts/modules/ElectionModule.sol:ElectionModule',
    proxyAddress
  );

  await fastForwardTo(
    (await ElectionModule.getNominationPeriodStartDate()) - 1,
    hre.ethers.provider
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
