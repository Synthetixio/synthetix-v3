const fs = require('fs/promises');
const path = require('path');

module.exports = async function importJson(location) {
  const data = await fs.readFile(path.resolve(location));
  return JSON.parse(data.toString());
};
