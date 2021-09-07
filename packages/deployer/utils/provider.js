async function getNonce(_signer) {
  const signer = _signer ? _signer : hre.ethers.provider.getSigner();
  const nonce = await hre.ethers.provider.getTransactionCount(signer.getAddress());
  return nonce;
}

function nextNonce(nonce) {
  return nonce + 1;
}

async function evaluateNextDeployedContractAddress(nonce, _signer) {
  const from = _signer
    ? await _signer.getAddress()
    : await hre.ethers.provider.getSigner().getAddress();
  return hre.ethers.utils.getContractAddress({ from, nonce });
}

module.exports = {
  getNonce,
  nextNonce,
  evaluateNextDeployedContractAddress,
};
