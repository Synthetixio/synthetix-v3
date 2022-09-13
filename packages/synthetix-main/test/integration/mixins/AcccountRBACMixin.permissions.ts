import { ethers } from 'ethers';

export default {
  DEPOSIT: ethers.utils.formatBytes32String('DEPOSIT'),
  ADMIN: ethers.utils.formatBytes32String('ADMIN'),
  WITHDRAW: ethers.utils.formatBytes32String('WITHDRAW'),
  MINT: ethers.utils.formatBytes32String('MINT'),
  ASSIGN: ethers.utils.formatBytes32String('ASSIGN'),
};
