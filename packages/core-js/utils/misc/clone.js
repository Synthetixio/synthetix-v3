function clone(objectToClone) {
  return JSON.parse(JSON.stringify(objectToClone));
}

module.exports = {
  clone,
};
