import { ethers } from 'ethers';
import hre from 'hardhat';
import { CannonWrapperGenericProvider, ChainBuilderContext } from '@usecannon/builder';

export function bootstrap() {
  let baseSystemSnapshot: string;

  let outputs: ChainBuilderContext;
  let provider: CannonWrapperGenericProvider;
  let signers: ethers.Signer[];

  before(async function prepareNode() {
    this.timeout(90000);

    if (hre.network.name !== 'cannon' && hre.network.name !== 'hardhat') {
      throw new Error('Tests can only be ran using the "cannon" or "hardhat" networks');
    }

    const cmd = hre.network.name === 'cannon' ? 'build' : 'deploy';
    const cannonBuild = await hre.run(`cannon:${cmd}`);

    outputs = cannonBuild.outputs;
    provider = cannonBuild.provider;
    signers = cannonBuild.signers;

    if (!outputs.contracts.Proxy) {
      throw new Error('Missing Proxy contract on build');
    }

    try {
      await provider.send('anvil_setBlockTimestampInterval', [1]);
    } catch (err) {
      console.warn('failed when setting block timestamp interval', err);
    }

    baseSystemSnapshot = await provider.send('evm_snapshot', []);
  });

  function getContract(contractName: string) {
    if (!outputs) throw new Error('Node not initialized yet');
    const contract = _getContractFromOutputs(contractName, outputs, provider);
    return Array.isArray(signers) && signers[0] ? contract.connect(signers[0]) : contract;
  }

  function getSigners() {
    if (!Array.isArray(signers)) throw new Error('Node not initialized yet');
    return [...signers];
  }

  function getProvider() {
    if (!provider) throw new Error('Node not initialized yet');
    return provider;
  }

  async function restoreSnapshot() {
    await provider.send('evm_revert', [baseSystemSnapshot]);
  }

  return {
    getContract,
    getSigners,
    getProvider,
    restoreSnapshot,
  };
}

function _getContractFromOutputs(
  contractName: string,
  outputs: ChainBuilderContext,
  provider: CannonWrapperGenericProvider
) {
  let contract;

  if (contractName.includes('.')) {
    const [importName, subContractName] = contractName.split('.');

    if (!outputs.imports[importName]) {
      throw new Error(`cannonfile does not includes an import named "${importName}"`);
    }

    contract = outputs.imports[importName]!.contracts![subContractName];
  } else {
    contract = outputs.contracts[contractName];
  }

  if (!contract) {
    throw new Error(`Contract "${contractName}" not found on cannon build`);
  }

  return new ethers.Contract(
    outputs.contracts.Proxy.address,
    contract.abi,
    provider
  ) as ethers.Contract;
}
