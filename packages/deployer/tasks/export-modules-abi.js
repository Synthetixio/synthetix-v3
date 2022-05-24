const { task } = require('hardhat/config');
const { TASK_EXPORT_MODULES_ABI } = require('../task-names');
const { getModulesFullyQualifiedNames } = require('../internal/contract-helper');

task(TASK_EXPORT_MODULES_ABI, 'Export the merged ABIs from all modules to a single file').setAction(
  async (_, hre) => {
    const modulesFullyQualifiedNames = await getModulesFullyQualifiedNames();

    const abis = await Promise.all(
      modulesFullyQualifiedNames.map(async (name) => {
        const { abi } = await hre.artifacts.readArtifact(name);
        return abi;
      })
    );

    console.log(JSON.stringify(abis.flat(), null, 2));
  }
);
