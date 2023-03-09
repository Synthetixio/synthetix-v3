import {
  ChainArtifacts,
  ChainBuilderContext,
  ChainBuilderRuntime,
  ChainBuilderRuntimeInfo,
  registerAction,
} from '@usecannon/builder';
import {
  getContractDefinitionFromPath,
  getMergedAbiFromContractPaths,
} from '@usecannon/builder/dist/util';
import { JTDDataType } from 'ajv/dist/core';
import Debug from 'debug';
import { ethers } from 'ethers';
import _ from 'lodash';
import solc from 'solc';
import { compileContract, getCompileInput } from '../compile';
import { generateRouter } from '../generate';
import { DeployedContractData } from '../types';

const debug = Debug('router:cannon');

const config = {
  properties: {
    contracts: { elements: { type: 'string' } },
  },
  optionalProperties: {
    from: { type: 'string' },
    salt: { type: 'string' },
    depends: { elements: { type: 'string' } },
  },
} as const;

export type Config = JTDDataType<typeof config>;

// ensure the specified contract is already deployed
// if not deployed, deploy the specified hardhat contract with specfied options, export
// address, abi, etc.
// if already deployed, reexport deployment options for usage downstream and exit with no changes
const routerAction = {
  validate: config,

  async getState(runtime: ChainBuilderRuntimeInfo, ctx: ChainBuilderContext, config: Config) {
    if (!runtime.baseDir) {
      return null; // skip consistency check
      // todo: might want to do consistency check for config but not files, will see
    }

    const newConfig = this.configInject(ctx, config);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contractAbis: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contractAddresses: any = {};

    for (const n of newConfig.contracts) {
      const contract = getContractDefinitionFromPath(ctx, n);
      if (!contract) {
        throw new Error(`contract not found: ${n}`);
      }

      contractAbis[n] = contract.abi;
      contractAddresses[n] = contract.address;
    }

    return {
      contractAbis,
      contractAddresses,
      config: newConfig,
    };
  },

  configInject(ctx: ChainBuilderContext, config: Config) {
    config = _.cloneDeep(config);

    config.contracts = _.map(config.contracts, (n: string) => _.template(n)(ctx));

    if (config.from) {
      config.from = _.template(config.from)(ctx);
    }

    if (config.salt) {
      config.salt = _.template(config.salt)(ctx);
    }

    return config;
  },

  async exec(
    runtime: ChainBuilderRuntime,
    ctx: ChainBuilderContext,
    config: Config,
    currentLabel: string
  ): Promise<ChainArtifacts> {
    debug('exec', config);

    const contracts: DeployedContractData[] = config.contracts.map((n) => {
      const contract = getContractDefinitionFromPath(ctx, n);
      if (!contract) {
        throw new Error(`contract not found: ${n}`);
      }

      return {
        constructorArgs: contract.constructorArgs,
        abi: contract.abi,
        deployedAddress: contract.address,
        deployTxnHash: contract.deployTxnHash,
        contractName: contract.contractName,
        sourceName: contract.sourceName,
        contractFullyQualifiedName: `${contract.sourceName}:${contract.contractName}`,
      };
    });

    const contractName = currentLabel.slice('router.'.length);

    const sourceCode = generateRouter({
      contractName,
      contracts,
    });

    debug('router source code', sourceCode);

    const inputData = await getCompileInput(contractName, sourceCode);
    const solidityInfo = await compileContract(contractName, sourceCode);

    // the abi is entirely basedon the fallback call so we have to generate ABI here
    const routableAbi = getMergedAbiFromContractPaths(ctx, config.contracts);

    runtime.reportContractArtifact(`${contractName}.sol:${contractName}`, {
      contractName,
      sourceName: `${contractName}.sol`,
      abi: routableAbi,
      bytecode: solidityInfo.bytecode,
      deployedBytecode: solidityInfo.deployedBytecode,
      linkReferences: {},
      source: {
        solcVersion: solc.version().match(/(^.*commit\.[0-9a-f]*)\..*/)[1],
        input: JSON.stringify(inputData),
      },
    });

    const deployTxn = await ethers.ContractFactory.fromSolidity(
      solidityInfo
    ).getDeployTransaction();

    const signer = config.from
      ? await runtime.getSigner(config.from)
      : await runtime.getDefaultSigner!(deployTxn, config.salt);

    debug('using deploy signer with address', await signer.getAddress());

    const deployedRouterContractTxn = await signer.sendTransaction(deployTxn);

    const receipt = await deployedRouterContractTxn.wait();

    return {
      contracts: {
        [contractName]: {
          address: receipt.contractAddress,
          abi: routableAbi,
          deployedOn: currentLabel,
          deployTxnHash: deployedRouterContractTxn.hash,
          contractName,
          sourceName: contractName + '.sol',
          //sourceCode
        },
      },
    };
  },
};

registerAction('router', routerAction);
