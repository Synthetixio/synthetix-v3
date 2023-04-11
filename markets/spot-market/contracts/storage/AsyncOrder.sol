//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {SynthUtil} from "../utils/SynthUtil.sol";

/**
 * @title Async order top level data storage
 */
library AsyncOrder {
    /**
     * @notice Thrown when the outstanding shares is a very small amount which throws off the shares calculation.
     * @dev This is thrown when the sanity check that checks to ensure the shares amount issued has the correct synth value fails.
     */
    error InsufficientSharesAmount(uint256 expected, uint256 actual);

    struct Data {
        /**
         * @dev tracking total shares for share calculation of synths escrowed.  instead of storing direct synth amounts, we store shares in case of token decay.
         */
        uint256 totalEscrowedSynthShares;
        /**
         * @dev # of total claims; used to generate a unique claim Id on commitment.
         */
        uint128 totalClaims;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.AsyncOrder", marketId));
        assembly {
            store.slot := s
        }
    }

    /**
     * @dev The following functions are used to escrow synths.  We use shares instead of direct synth amounts to account for token decay.
     * @dev if there's no decay, then the shares will be equal to the synth amount.
     */
    function transferIntoEscrow(
        uint128 marketId,
        address from,
        uint256 synthAmount,
        uint256 maxRoundingLoss
    ) internal returns (uint256 sharesAmount) {
        Data storage asyncOrderData = load(marketId);
        ITokenModule token = SynthUtil.getToken(marketId);

        sharesAmount = asyncOrderData.totalEscrowedSynthShares == 0
            ? synthAmount
            : (synthAmount * asyncOrderData.totalEscrowedSynthShares) /
                token.balanceOf(address(this));

        token.transferFrom(from, address(this), synthAmount);

        asyncOrderData.totalEscrowedSynthShares += sharesAmount;

        // sanity check to ensure the right shares amount is calculated
        uint256 acceptableSynthAmount = convertSharesToSynth(
            asyncOrderData,
            marketId,
            sharesAmount
        ) + maxRoundingLoss;
        if (acceptableSynthAmount < synthAmount) {
            revert InsufficientSharesAmount({expected: synthAmount, actual: acceptableSynthAmount});
        }
    }

    /**
     * @notice  First calculates the synth amount based on shares then burns that amount
     */
    function burnFromEscrow(uint128 marketId, uint256 sharesAmount) internal {
        Data storage asyncOrderData = load(marketId);
        uint256 synthAmount = convertSharesToSynth(asyncOrderData, marketId, sharesAmount);

        asyncOrderData.totalEscrowedSynthShares -= sharesAmount;

        ITokenModule token = SynthUtil.getToken(marketId);
        // if there's no more shares, then burn the entire balance
        uint256 burnAmt = asyncOrderData.totalEscrowedSynthShares == 0
            ? token.balanceOf(address(this))
            : synthAmount;

        token.burn(address(this), burnAmt);
    }

    /**
     * @notice  calculates the synth amount based on the sharesAmount input and transfers that to the `to` address.
     * @dev   is used when cancelling an order
     */
    function transferFromEscrow(uint128 marketId, address to, uint256 sharesAmount) internal {
        Data storage asyncOrderData = load(marketId);
        uint256 synthAmount = convertSharesToSynth(asyncOrderData, marketId, sharesAmount);

        asyncOrderData.totalEscrowedSynthShares -= sharesAmount;

        ITokenModule token = SynthUtil.getToken(marketId);
        // if there's no more shares, then transfer the entire balance
        uint256 transferAmt = asyncOrderData.totalEscrowedSynthShares == 0
            ? token.balanceOf(address(this))
            : synthAmount;

        token.transfer(to, transferAmt);
    }

    /**
     * @notice given the shares amount, returns the synth amount
     */
    function convertSharesToSynth(
        Data storage asyncOrderData,
        uint128 marketId,
        uint256 sharesAmount
    ) internal view returns (uint256 synthAmount) {
        uint256 currentSynthBalance = SynthUtil.getToken(marketId).balanceOf(address(this));
        return (sharesAmount * currentSynthBalance) / asyncOrderData.totalEscrowedSynthShares;
    }
}
