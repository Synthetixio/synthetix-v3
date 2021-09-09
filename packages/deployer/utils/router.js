const { capitalize } = require('@synthetixio/core-js/utils/string');

function getRouterName({ network = 'local', instance = 'official' } = {}) {
  return ['GenRouter', network, instance, '.sol'].map(capitalize).join('');
}

module.exports = {
  getRouterName,
};
