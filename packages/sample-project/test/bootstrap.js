const hre = require('hardhat');

let baseSystemSnapshot;
let provider;
let signers;
let outputs;

before(async function prepareNode() {
  if (hre.network.name !== 'cannon') {
    throw new Error('Tests can only be ran using the "cannon" network');
  }

  const cannonInfo = await hre.run('cannon:build');

  provider = cannonInfo.provider;
  signers = cannonInfo.signers;
  outputs = cannonInfo.outputs;

  if (!outputs.contracts.Proxy) {
    throw new Error('Missing Proxy contract on build');
  }

  await provider.send('anvil_setBlockTimestampInterval', [1]);

  await initialize();

  baseSystemSnapshot = await provider.send('evm_snapshot', []);
});

function getContract(contractName) {
  if (!outputs) throw new Error('Node not initialized yet');
  if (!outputs.contracts[contractName]) {
    throw new Error(`Contract "${contractName}" not found`);
  }

  return new hre.ethers.Contract(
    outputs.contracts.Proxy.address,
    outputs.contracts[contractName].abi,
    provider
  );
}

function getSigners() {
  if (!Array.isArray(signers)) throw new Error('Node not initialized yet');
  return [...signers];
}

async function initialize() {
  const [owner] = getSigners();
  const OwnerModule = getContract('OwnerModule');
  const tx = await OwnerModule.connect(owner).initializeOwnerModule(await owner.getAddress());
  await tx.wait();
}

module.exports = function bootstrap() {
  before(async function loadSnapshot() {
    await provider.send('evm_revert', [baseSystemSnapshot]);
  });

  return {
    getContract,
    getSigners,
  };
};
