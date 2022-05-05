const hre = require('hardhat');
const { subtask } = require('hardhat/config');
const { TASK_DEPLOY } = require('@synthetixio/deployer/task-names');
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const { calculateEpochDates } = require('./calculate-epoch-dates');
const { initialize } = require('./initialize');

async function main() {
  await startHardhatNode();

  await hre.run(TASK_DEPLOY, {
    noConfirm: true,
    clear: true,
  });

  const DebtShareMockFactory = await hre.ethers.getContractFactory(
    'contracts/mocks/DebtShareMock.sol:DebtShareMock'
  );

  const DebtShareMock = await DebtShareMockFactory.deploy();

  const epochDates = await calculateEpochDates('90', '7');

  const info = {
    network: hre.network.name,
    instance: 'official',
  };

  await initialize(`
    {
      "proxyAddress": "${getProxyAddress(info)}",
      "ownerAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      "councilTokenName": "Synthetix Governance Module",
      "councilTokenSymbol": "SGT",
      "firstCouncilMembers": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"],
      "nominationPeriodStartDate": ${epochDates.nominationPeriodStartDate},
      "votingPeriodStartDate": ${epochDates.votingPeriodStartDate},
      "epochEndDate": ${epochDates.epochEndDate},
      "debtShareAddress": "${DebtShareMock.address}"
    }
  `);

  console.log(`
    "councilTokenName": "Synthetix Governance Module",
    "proxyAddress": "${getProxyAddress(info)}"
  `);
}

function startHardhatNode() {
  return new Promise((resolve) => {
    subtask('node:server-ready').setAction(async ({ server }) => {
      resolve(server);
    });

    hre.run('node');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
