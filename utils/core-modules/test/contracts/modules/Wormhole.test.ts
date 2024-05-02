import hre from "hardhat";
import { describe, expect, test } from "@jest/globals";
import { ethers } from "ethers";
import { getWallet, getDeliveryHash, sleep } from "./WormholeUtils";
import { CHAIN_ID_TO_NAME } from "@certusone/wormhole-sdk";
// import { waitForDelivery } from "./getStatus";

describe("Hello Wormhole Integration Tests on Testnet", () => {

  before('deploy wh to both chains', function () {
    [owner, user] = getSigners();
    NftModule = getContractBehindProxy('NftModule');
  });


  test(
    "Tests the sending of a random greeting",
    async () => {
      const arbitraryGreeting = `Hello Wormhole ${new Date().getTime()}`;
      const sourceHelloWormholeContract = await hre.ethers.deployContract("WormholeCrossChainModule", []);
    //   const targetHelloWormholeContract = getHelloWormhole(targetChain);

      const cost = await sourceHelloWormholeContract.quoteCrossChainGreeting(
        targetChain
      );
      console.log(
        `Cost of sending the greeting: ${ethers.utils.formatEther(
          cost
        )} testnet AVAX`
      );

      console.log(`Sending greeting: ${arbitraryGreeting}`);
      const tx = await sourceHelloWormholeContract.sendCrossChainGreeting(
        targetChain,
        targetHelloWormholeContract.address,
        arbitraryGreeting,
        { value: cost }
      );
      console.log(`Transaction hash: ${tx.hash}`);
      const rx = await tx.wait();

      await waitForDelivery(CHAIN_ID_TO_NAME[sourceChain], tx.hash);

      console.log(`Reading greeting`);
      const readGreeting = await targetHelloWormholeContract.latestGreeting();
      console.log(`Latest greeting: ${readGreeting}`);
      expect(readGreeting).toBe(arbitraryGreeting);
    },
    60 * 1000 * 60
  ); // timeout
});

