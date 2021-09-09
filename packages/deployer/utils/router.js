const { capitalize } = require('@synthetixio/core-js/utils/string');

// TODO: Remove after this name becomes constant
function getRouterName({ network = 'local', instance = 'official' } = {}) {
  return ['GenRouter', network, instance, '.sol'].map(capitalize).join('');
}

module.exports = {
  getRouterName,
};
