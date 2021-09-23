const { findInheritorsOf, getSlotAddresses, findDuplicateSlots, findStateVariables } = require('./ast-helper');
const logger = require('@synthetixio/core-js/utils/logger');
const filterValues = require('filter-values');

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

function findUnsafeStorageUsageInModules(contracts) {
  const errors = [];

  const moduleNames = Object.keys(filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule));

  Object.entries(contracts).map(([name, contract]) => {
    const vars = findStateVariables(name, contract);
    if (vars) {
      if (moduleNames.includes(name)) {
        vars.map((node) => {
          errors.push({
            msg: `Unsafe state variable declaration in ${name}: "${node.typeName.name} ${node.name}"`,
          });
        });
      } else {
        const inheritors = findInheritorsOf(name, contracts).filter((i) => moduleNames.includes(i));
        vars.map((node) => {
          errors.push({
            msg: `Unsafe state variable declaration in ${name} (inherited by ${inheritors}): "${node.typeName.name} ${node.name}"`,
          });
        });
      }
    }
  });

  return errors;
}

function findInvalidMutationsOnNamespaces() {
  logger.info(
    'Append is the only update enabled on Namespaces. BE AWARE THIS IS NOT NOT AUTOMATICALLY VERIFIED AT THE MOMENT'
  );

  return [];
}

module.exports = {
  findDuplicateStorageNamespaces,
  findUnsafeStorageUsageInModules,
  findInvalidMutationsOnNamespaces,
};
