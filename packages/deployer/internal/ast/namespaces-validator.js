const { getSlotAddresses, findDuplicateSlots } = require('./ast-helper');
const logger = require('@synthetixio/core-js/utils/logger');

function findDuplicateStorageNamespaces(contracts) {
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

function findRegularStorageSlots() {
  logger.warn(
    'Storage definition is reserved to namespace mixins. BE AWARE THIS IS NOT NOT AUTOMATICALLY VERIFIED AT THE MOMENT'
  );
  return null;
}

function findInvalidMutationsOnNamespaces() {
  logger.warn(
    'Append is the only update enabled on Namespaces. BE AWARE THIS IS NOT NOT AUTOMATICALLY VERIFIED AT THE MOMENT'
  );
  return null;
}

module.exports = {
  findDuplicateStorageNamespaces,
  findRegularStorageSlots,
  findInvalidMutationsOnNamespaces,
};
