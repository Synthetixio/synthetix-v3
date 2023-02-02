/* eslint-env mocha */

import path from 'node:path';
import { ChainBuilderContext } from '@usecannon/builder';
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
  let provider: ethers.providers.JsonRpcProvider;
  let signers: ethers.Signer[];

  before(async function prepareNode() {
    this.timeout(90000);

    const generatedPath = path.resolve(hre.config.paths.tests, 'generated');
    const typechainFolder = path.resolve(generatedPath, 'typechain');
    const writeDeployments = path.resolve(generatedPath, 'deployments');

    const cannonOpts =
      hre.network.name === 'cannon' ? { cannonfile } : { cannonfile, noVerify: true };

    const cannonInfo = await hre.run('cannon:build', {
      writeDeployments,
      ...cannonOpts,
    });

    const allFiles = glob(hre.config.paths.root, [`${writeDeployments}/*.json`]);

    await runTypeChain({
      cwd: hre.config.paths.root,
      filesToProcess: allFiles,
      allFiles,
      target: 'ethers-v5',
      outDir: typechainFolder,
    });

    outputs = cannonInfo.outputs;
    provider = cannonInfo.provider as ethers.providers.JsonRpcProvider;
    signers = cannonInfo.signers as ethers.Signer[];

    for (const signer of signers) {
      await provider.send('hardhat_setBalance', [
        await signer.getAddress(),
        `0x${(1e22).toString(16)}`,
      ]);
    }

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

  function getContract<T extends keyof Contracts>(contractName: T, address?: string) {
    if (!outputs) throw new Error('Node not initialized yet');
    const contract = _getContractFromOutputs(contractName as string, outputs, provider, address);
    const [owner] = Array.isArray(signers) ? signers : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Contract = owner ? contract.connect(owner as unknown as any) : contract;
    return Contract as unknown as Contracts[T];
  }

  function createSnapshot() {
    let snapshotId: string;

    before('create snapshot', async function () {
      snapshotId = await provider.send('evm_snapshot', []);
    });

    return async function restoreSnapshot() {
      await provider.send('evm_revert', [snapshotId]);
      snapshotId = await provider.send('evm_snapshot', []);
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
  provider: ethers.providers.JsonRpcProvider,
  address?: string
) {
  let contract;

  if (contractName.includes('.')) {
    const nestedContracts = contractName.split('.');

    // this logic handles deeply nested imports such as synthetix.oracle_manager.Proxy
    // which is really outputs.imports.synthetix.imports.oracle_manager.contracts.Proxy

    let imports: ChainBuilderContext['imports'] | undefined = outputs.imports;

    for (const c of nestedContracts.slice(0, -2)) {
      if (!imports![c]) {
        throw new Error(`cannonfile does not includes an import named "${c}"`);
      } else {
        imports = imports![c].imports;
      }
    }

    contract =
      imports![nestedContracts[nestedContracts.length - 2]].contracts![
        nestedContracts[nestedContracts.length - 1]
      ];
  } else {
    contract = outputs.contracts[contractName];
  }

  if (!contract) {
    throw new Error(`Contract "${contractName}" not found on cannon build`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ethers.Contract(address || contract.address, contract.abi, provider as unknown as any);
}
