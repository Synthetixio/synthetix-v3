import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { ethers } from 'ethers';

export async function getHardhatSigners(
  hre: HardhatRuntimeEnvironment,
  provider: ethers.providers.Provider
) {
  const accounts = hre.network.config.accounts;
  let signers: ethers.Signer[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Wallet: typeof ethers.Wallet = (hre as any).ethers.Wallet;

  if (Array.isArray(accounts)) {
    signers = accounts.map(
      (account) => new Wallet(typeof account === 'string' ? account : account.privateKey)
    );
  } else if (accounts === 'remote') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error('Cannot use remote accounts');
  } else {
    signers = Array(accounts.count)
      .fill(0)
      .map((_, i) =>
        Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${i + accounts.initialIndex}`)
      );
  }

  return signers.map((signer) => signer.connect(provider));
}
