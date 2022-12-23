//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";

import "../storage/AsyncOrder.sol";

library SynthUtil {
    using AssociatedSystem for AssociatedSystem.Data;

    function getToken(uint128 marketId) internal view returns (ITokenModule) {
        bytes32 synthId = getSystemId(marketId);
        return AssociatedSystem.load(synthId).asToken();
    }

    function getSystemId(uint128 marketId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("synth", marketId));
    }

    function getSynthTokenAddress(uint128 marketId) internal view returns (address) {
        return AssociatedSystem.load(SynthUtil.getSystemId(marketId)).proxy;
    }

    /**
     * Because synths may decay, we track shares of synths held in escrow for async orderers and the market.
     * - When synths are minted by the market or transferred in, the market or the orderer is credited shares.
     * - When synths are burned by the market or transferred out, the recipient receives their share of the
     *   total amount of shares held in the market contract and their shares are reduced.
     **/

    // Mint synths to escrow and add shares, tracked as owned by the market
    function mintToEscrow(uint128 marketId, uint256 synthAmount) internal {
        ITokenModule token = getToken(marketId);
        AsyncOrder.Data storage asyncOrderData = AsyncOrder.load(marketId);

        token.mint(address(this), synthAmount);

        uint sharesAmount = asyncOrderData.totalEscrowedSynthShares == 0
            ? synthAmount
            : (synthAmount * asyncOrderData.totalEscrowedSynthShares) /
                token.balanceOf(address(this));
        asyncOrderData.escrowedSynthShares[address(this)] += sharesAmount;
        asyncOrderData.totalEscrowedSynthShares += sharesAmount;
    }

    // Convert synth amount to shares, remove these shares from the market, and burn the shares amount
    function burnFromEscrow(uint128 marketId, uint256 synthAmount) internal {
        ITokenModule token = getToken(marketId);
        AsyncOrder.Data storage asyncOrderData = AsyncOrder.load(marketId);

        uint256 sharesAmount = (synthAmount * asyncOrderData.totalEscrowedSynthShares) /
            token.balanceOf(address(this));
        asyncOrderData.escrowedSynthShares[address(this)] -= sharesAmount;
        asyncOrderData.totalEscrowedSynthShares -= sharesAmount;

        token.burn(address(this), sharesAmount);
    }

    // Transfer synths into escrow and add shares, tracked as owned by the sender
    function transferIntoEscrow(uint128 marketId, address from, uint256 synthAmount) internal {
        ITokenModule token = getToken(marketId);
        AsyncOrder.Data storage asyncOrderData = AsyncOrder.load(marketId);

        token.transferFrom(from, address(this), synthAmount);

        uint256 sharesAmount = asyncOrderData.totalEscrowedSynthShares == 0
            ? synthAmount
            : (synthAmount * asyncOrderData.totalEscrowedSynthShares) /
                token.balanceOf(address(this));
        asyncOrderData.escrowedSynthShares[from] += sharesAmount;
        asyncOrderData.totalEscrowedSynthShares += sharesAmount;
    }

    // Convert synth amount to shares, remove these shares from the market, and transfer the shares amount out of escrow
    function transferOutOfEscrow(uint128 marketId, address to, uint256 synthAmount) internal {
        ITokenModule token = getToken(marketId);
        AsyncOrder.Data storage asyncOrderData = AsyncOrder.load(marketId);

        uint256 sharesAmount = (synthAmount * asyncOrderData.totalEscrowedSynthShares) /
            token.balanceOf(address(this));
        asyncOrderData.escrowedSynthShares[to] -= sharesAmount;
        asyncOrderData.totalEscrowedSynthShares -= sharesAmount;

        token.transferFrom(address(this), to, sharesAmount);
    }
}
