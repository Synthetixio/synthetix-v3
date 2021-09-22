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

  const errors = [];
  if (duplicates) {
    const details = duplicates.map(
      (d) => `  > ${d.address} found in storage contracts ${d.contracts}\n`
    );

    errors.push({
      msg: `Duplicate Namespaces found!\n${details.join('')}`,
    });
  }

  return errors;
}

function findRegularStorageSlots() {
  logger.info(
    'Storage definition is reserved to namespace mixins. BE AWARE THIS IS NOT NOT AUTOMATICALLY VERIFIED AT THE MOMENT'
  );

  return [];
}

function findInvalidMutationsOnNamespaces() {
  logger.info(
    'Append is the only update enabled on Namespaces. BE AWARE THIS IS NOT NOT AUTOMATICALLY VERIFIED AT THE MOMENT'
  );
  return [];
}

module.exports = {
  findDuplicateStorageNamespaces,
  findRegularStorageSlots,
  findInvalidMutationsOnNamespaces,
};
