"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = __importDefault(require("hardhat"));
const task_names_1 = require("@synthetixio/hardhat-router/dist/task-names");
/**
 * Generate the Router contract file. It also includes the local CoreModule.
 */
exports.generate = async function generate(runtime, routerFqName, contractsMapJson, ...extraContractsJson) {
    const contracts = Object.values(JSON.parse(contractsMapJson)).map(_parseCannonContract);
    if (extraContractsJson) {
        contracts.push(...extraContractsJson.map((c) => JSON.parse(c)).map(_parseCannonContract));
    }
    await hardhat_1.default.run(task_names_1.SUBTASK_GENERATE_ROUTER, {
        router: routerFqName,
        contracts,
    });
    // need to re-run compile to ensure artifact is available to cannon
    await hardhat_1.default.run('compile');
    return { contracts: {} };
};
function _parseCannonContract(c) {
    return {
        deployedAddress: c.address,
        contractName: c.contractName,
        abi: c.abi,
    };
}
//# sourceMappingURL=generate.js.map