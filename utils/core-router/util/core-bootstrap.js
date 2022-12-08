"use strict";
/* eslint-env mocha */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreBootstrap = void 0;
const node_path_1 = __importDefault(require("node:path"));
const ethers_1 = require("ethers");
const hardhat_1 = __importDefault(require("hardhat"));
const typechain_1 = require("typechain");
function coreBootstrap({ cannonfile = 'cannonfile.toml' } = {}) {
    let outputs;
    let provider;
    let signers;
    before(async function prepareNode() {
        this.timeout(90000);
        const cmd = hardhat_1.default.network.name === 'cannon' ? 'build' : 'deploy';
        const generatedPath = node_path_1.default.resolve(hardhat_1.default.config.paths.tests, 'generated');
        const deploymentsFolder = node_path_1.default.resolve(generatedPath, 'deployments');
        const typechainFolder = node_path_1.default.resolve(generatedPath, 'typechain');
        // Set deployments folder for "deploy" command
        hardhat_1.default.config.paths.deployments = deploymentsFolder;
        const cannonInfo = await hardhat_1.default.run(`cannon:${cmd}`, {
            cannonfile,
            overrideManifest: cannonfile,
            writeDeployments: cmd === 'deploy' ? true : hardhat_1.default.config.paths.deployments, // deploy the cannon deployments
        });
        const allFiles = (0, typechain_1.glob)(hardhat_1.default.config.paths.root, [`${deploymentsFolder}/*.json`]);
        await (0, typechain_1.runTypeChain)({
            cwd: hardhat_1.default.config.paths.root,
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
        }
        catch (err) {
            console.warn('failed when setting block timestamp interval', err);
        }
    });
    function getSigners() {
        if (!Array.isArray(signers))
            throw new Error('Node not initialized yet');
        return [...signers];
    }
    function getProvider() {
        if (!provider)
            throw new Error('Node not initialized yet');
        return provider;
    }
    function getContract(contractName) {
        if (!outputs)
            throw new Error('Node not initialized yet');
        const contract = _getContractFromOutputs(contractName, outputs, provider);
        const [owner] = Array.isArray(signers) ? signers : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Contract = owner ? contract.connect(owner) : contract;
        return Contract;
    }
    function createSnapshot() {
        let snapshotId;
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
exports.coreBootstrap = coreBootstrap;
function _getContractFromOutputs(contractName, outputs, provider) {
    let contract;
    if (contractName.includes('.')) {
        const [importName, subContractName] = contractName.split('.');
        if (!outputs.imports[importName]) {
            throw new Error(`cannonfile does not includes an import named "${importName}"`);
        }
        contract = outputs.imports[importName].contracts[subContractName];
    }
    else {
        contract = outputs.contracts[contractName];
    }
    if (!contract) {
        throw new Error(`Contract "${contractName}" not found on cannon build`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new ethers_1.ethers.Contract(contract.address, contract.abi, provider);
}
//# sourceMappingURL=core-bootstrap.js.map