const {
  findDependenciesOf,
  getSlotAddresses,
  findDuplicateSlots,
  findStateVariables,
} = require('./ast-helper');
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

  const moduleNames = Object.keys(
    filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule)
  );

  // Find all contracts inherted by modules
  const candidates = [];
  for (const moduleName of moduleNames) {
    const deps = findDependenciesOf(moduleName, contracts).map((dep) => dep.name);
    deps.forEach((dep) => {
      if (!candidates.includes(dep)) {
        candidates.push(dep);
      }
    });
  }

  // Look for state variable declarations
  candidates.map((contractName) => {
    const vars = findStateVariables(contractName, contracts[contractName]);
    if (vars) {
      vars.map((node) => {
        errors.push({
          msg: `Unsafe state variable declaration in ${contractName}: "${node.typeName.name} ${node.name}"`,
        });
      });
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
