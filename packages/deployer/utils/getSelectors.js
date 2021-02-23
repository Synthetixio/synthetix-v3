const { getModules } = require('./getModules');

async function getAllSelectors({ hre }) {
  const modules = getModules({ hre });

  let allSelectors = [];

  for (let module of modules) {
    let selectors = await getContractSelectors({ contractName: module.name, hre });

    selectors.map((s) => (s.module = module.name));

    allSelectors = allSelectors.concat(selectors);
  }

  allSelectors = allSelectors.sort((a, b) => {
    return parseInt(a.selector, 16) - parseInt(b.selector, 16);
  });

  return allSelectors;
}

async function getContractSelectors({ contractName, hre }) {
  const contract = await hre.ethers.getContractAt(
    contractName,
    '0x0000000000000000000000000000000000000001'
  );

  return contract.interface.fragments.reduce((selectors, fragment) => {
    if (fragment.type === 'function') {
      selectors.push({
        name: fragment.name,
        selector: contract.interface.getSighash(fragment),
      });
    }

    return selectors;
  }, []);
}

module.exports = {
  getContractSelectors,
  getAllSelectors,
};
