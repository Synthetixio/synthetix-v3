const path = require('path');
const rimraf = require('rimraf');
const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');

const {
  getContractDataFromDebugFile,
  getDebugDataFile,
  getSlotAddress,
  findDuplicateSlots,
} = require('../internal/ast-helper');
const { SUBTASK_VALIDATE_NAMESPACES } = require('../task-names');

subtask(SUBTASK_VALIDATE_NAMESPACES).setAction(async (_, hre) => {
  logger.subtitle('Validating namespaces');

  const debugFiles = await _getDebugFiles(hre);
  const slots = [];

  debugFiles.forEach((file) => {
    const { contractName, contractPath } = getContractDataFromDebugFile(file);
    const debugDataFile = getDebugDataFile(file, contractPath);
    const address = getSlotAddress(contractName, debugDataFile.output.sources);
    slots.push({ contractName, slotAddress: address });
  });

  const duplicates = findDuplicateSlots(slots);

  if (duplicates) {
    const details = duplicates.map(
      (d) => `  > ${d.slotAddress} found in storage contracts ${d.contracts}\n`
    );

    logger.error(`Duplicate Namespaces found!\n${details.join('')}`);
    logger.info(`Deleting ${hre.deployer.deployment.file}`);
    rimraf.sync(path.resolve(hre.config.paths.root, hre.deployer.deployment.file));
    process.exit(0);
  }

  logger.checked('Namespaces are valid');
});

async function _getDebugFiles(hre) {
  const artifacts = await hre.artifacts.getArtifactPaths();

  return artifacts
    .filter((filename) => filename.indexOf('contracts/storage/') > 0)
    .map((file) => file.replace('.json', '.dbg.json'));
}
