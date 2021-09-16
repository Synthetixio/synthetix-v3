const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');

const { getSlotAddresses, findDuplicateSlots } = require('../internal/ast-helper');
const { SUBTASK_VALIDATE_STORAGE, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(SUBTASK_VALIDATE_STORAGE).setAction(async (_, hre) => {
  logger.subtitle('Validating Storage usage');

  const { contracts } = await _getSourcesAST(hre);

  let errorsFound;
  errorsFound = _findDuplicateStorageNamespaces(contracts) || errorsFound;
  errorsFound = _findRegularStorageSlots() || errorsFound;
  errorsFound = _findInvalidMutationsOnNamespaces() || errorsFound;

  if (errorsFound) {
    logger.error('Storate usage is not valid');
    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }
  logger.checked('Namespaces are valid');
});

async function _getSourcesAST(hre) {
  const fqns = await hre.artifacts.getAllFullyQualifiedNames();

  const contracts = {};
  for (const fqn of fqns) {
    const bi = await hre.artifacts.getBuildInfo(fqn);
    const split = fqn.split(':');
    const solPath = split[0];
    const contractName = split[1];
    // Hardhat will include the contract name when it builds the json only if any source file has more than one contract.
    // "sources": { "contracts/Proxy.sol": { "Proxy": { "ast":... , "id":...} } } (if any source has more than one contract defined)
    // "sources": { "contracts/Proxy.sol": { "ast":... , "id":...} } (if not any source has more than one contract defined)
    contracts[contractName] = bi.output.sources[solPath][contractName]
      ? bi.output.sources[solPath][contractName].ast
      : bi.output.sources[solPath].ast;
  }
  return { contracts };
}

function _findDuplicateStorageNamespaces(contracts) {
  const slots = [];
  for (var [contractName, ast] of Object.entries(contracts)) {
    const slotAddresses = getSlotAddresses(contractName, ast);
    if (slotAddresses) {
      slotAddresses.forEach((address) => slots.push({ contractName, address }));
    }
  }
  const duplicates = findDuplicateSlots(slots);

  if (duplicates) {
    const details = duplicates.map(
      (d) => `  > ${d.address} found in storage contracts ${d.contracts}\n`
    );

    logger.error(`Duplicate Namespaces found!\n${details.join('')}`);
  }
  return duplicates;
}

function _findRegularStorageSlots() {
  logger.warn(
    'Storage definition is reserved to namespace mixins. BE AWARE THIS IS NOT NOT AUTOMATICALLY VERIFIED AT THE MOMENT'
  );
  return null;
}

function _findInvalidMutationsOnNamespaces() {
  logger.warn(
    'Append is the only update enabled on Namespaces. BE AWARE THIS IS NOT NOT AUTOMATICALLY VERIFIED AT THE MOMENT'
  );
  return null;
}
