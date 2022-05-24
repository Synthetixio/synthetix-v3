const { task } = require('hardhat/config');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { TASK_EXPORT_MODULES_ABI } = require('../task-names');
const { getModulesFullyQualifiedNames } = require('../internal/contract-helper');

task(TASK_EXPORT_MODULES_ABI, 'Export the merged ABIs from all modules to a single file')
  .addOptionalParam('include', 'optional comma separated contract names to include', '')
  .setAction(async ({ include }, hre) => {
    const whitelist = include
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    const modulesFullyQualifiedNames = await getModulesFullyQualifiedNames();

    const contractNames = modulesFullyQualifiedNames.filter((name) => {
      if (whitelist.length === 0) return true;
      const { contractName } = parseFullyQualifiedName(name);
      return whitelist.includes(contractName);
    });

    const abis = await Promise.all(
      contractNames.map(async (name) => {
        const { abi } = await hre.artifacts.readArtifact(name);
        return abi;
      })
    );

    console.log(JSON.stringify(abis.flat(), null, 2));
  });
