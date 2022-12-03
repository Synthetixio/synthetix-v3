/* eslint-env mocha */

import path from 'node:path';
import { CannonWrapperGenericProvider, ChainBuilderContext } from '@usecannon/builder';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { glob, runTypeChain } from 'typechain';

interface Params {
  cannonfile?: string;
}

// Deployments path added by hardhat-cannon
declare module 'hardhat/types/config' {
  export interface ProjectPathsConfig {
    deployments: string;
  }
}

export function coreBootstrap<Contracts>({ cannonfile = 'cannonfile.toml' }: Params = {}) {
  let outputs: ChainBuilderContext;
  let provider: CannonWrapperGenericProvider;
  let signers: ethers.Signer[];

  before(async function prepareNode() {
    this.timeout(90000);

    const cmd = hre.network.name === 'cannon' ? 'build' : 'deploy';

    const generatedPath = path.resolve(hre.config.paths.tests, 'generated');
    const deploymentsFolder = path.resolve(generatedPath, 'deployments');
    const typechainFolder = path.resolve(generatedPath, 'typechain');

    // Set deployments folder for "deploy" command
    hre.config.paths.deployments = deploymentsFolder;

    const cannonInfo = await hre.run(`cannon:${cmd}`, {
      cannonfile, // build option to override cannonfile
      overrideManifest: cannonfile, // deploy option to override cannonfile
      writeDeployments: cmd === 'deploy' ? true : hre.config.paths.deployments, // deploy the cannon deployments
    });

    const allFiles = glob(hre.config.paths.root, [`${deploymentsFolder}/*.json`]);

    await runTypeChain({
      cwd: hre.config.paths.root,
      filesToProcess: allFiles,
      allFiles,
      target: 'ethers-v5',
      outDir: typechainFolder,
    });

    outputs = cannonInfo.outputs;
    provider = cannonInfo.provider;
    signers = cannonInfo.signers;

    try {
      await provider.send('anvil_setBlockTimestampInterval', [1]);
    } catch (err) {
      console.warn('failed when setting block timestamp interval', err);
    }
  });

  function getSigners() {
    if (!Array.isArray(signers)) throw new Error('Node not initialized yet');
    return [...signers];
  }

  function getProvider() {
    if (!provider) throw new Error('Node not initialized yet');
    return provider;
  }

  function getContract(contractName: keyof Contracts) {
    if (!outputs) throw new Error('Node not initialized yet');
    const contract = _getContractFromOutputs(contractName as string, outputs, provider);
    const [owner] = Array.isArray(signers) ? signers : [];
    const Contract = owner ? contract.connect(owner) : contract;
    return Contract as unknown as Contracts[typeof contractName];
  }

  function createSnapshot() {
    let snapshotId: string;

    before('create snapshot', async function () {
      snapshotId = await provider.send('evm_snapshot', []);
    });

    return async function restoreBaseSnapshot() {
      await provider.send('evm_revert', [snapshotId]);
    };
  }

  return {
    getContract,
    getSigners,
    getProvider,
    createSnapshot,
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

  return new ethers.Contract(contract.address, contract.abi, provider) as ethers.Contract;
}
