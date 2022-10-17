/* istanbul ignore file */

const axios = require('axios');

const action = (actionName) => `https://www.4byte.directory/api/v1/${actionName}/`;

exports.importAbi = async function (abi) {
  const { data } = await axios({
    method: 'post',
    url: action('import-abi'),
    headers: { 'Content-Type': 'application/json' },
    data: {
      contract_abi: JSON.stringify(abi),
    },
  });

  return data;
};
