const hre = require('hardhat');
const logger = require('@synthetixio/core-js/utils/io/logger');

const councils = [
  {
    name: 'ambassador-council',
  },
  {
    name: 'grants-council',
  },
  {
    name: 'spartan-council',
  },
  {
    name: 'treasury-council',
  },
];

async function main() {
  for (const council of councils) {
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
