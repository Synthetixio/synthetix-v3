module.exports = {
  proxyContract: 'Proxy',
  // Helper function for selecting which public functions are going to be added
  // to the main Router. By default filter out the ones added during instrumentation
  // by solidity coverage
  routerFunctionFilter: (fnName) => !fnName.startsWith('c_0x'),
  paths: {
    deployments: 'deployments',
    modules: 'modules',
  },
};
