//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "../utils/SynthUtil.sol";

/**
 * @title Async order top level data storage
 */
library AsyncOrder {
    error InvalidSharesCalculation(uint256 expected, uint256 actual);

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
    ) internal returns (uint sharesAmount) {
        Data storage asyncOrderData = load(marketId);
        ITokenModule token = SynthUtil.getToken(marketId);

        sharesAmount = asyncOrderData.totalEscrowedSynthShares == 0
            ? synthAmount
            : (synthAmount * asyncOrderData.totalEscrowedSynthShares) /
                token.balanceOf(address(this));

        token.transferFrom(from, address(this), synthAmount);
        asyncOrderData.totalEscrowedSynthShares += sharesAmount;

        // sanity check to ensure the right shares amount is calculated
        uint acceptableSynthAmount = convertSharesToSynth(asyncOrderData, marketId, sharesAmount) +
            maxRoundingLoss;
        if (acceptableSynthAmount < synthAmount) {
            revert InvalidSharesCalculation({expected: synthAmount, actual: acceptableSynthAmount});
        }
    }

    function burnFromEscrow(uint128 marketId, uint256 sharesAmount) internal {
        Data storage asyncOrderData = load(marketId);
        uint256 synthAmount = convertSharesToSynth(asyncOrderData, marketId, sharesAmount);

        asyncOrderData.totalEscrowedSynthShares -= sharesAmount;

        ITokenModule token = SynthUtil.getToken(marketId);
        // if there's no more shares, then burn the entire balance
        uint burnAmt = asyncOrderData.totalEscrowedSynthShares == 0
            ? token.balanceOf(address(this))
            : synthAmount;

        token.burn(address(this), burnAmt);
    }

    function transferFromEscrow(uint128 marketId, address to, uint256 sharesAmount) internal {
        Data storage asyncOrderData = load(marketId);
        uint256 synthAmount = convertSharesToSynth(asyncOrderData, marketId, sharesAmount);

        asyncOrderData.totalEscrowedSynthShares -= sharesAmount;

        ITokenModule token = SynthUtil.getToken(marketId);
        // if there's no more shares, then transfer the entire balance
        uint transferAmt = asyncOrderData.totalEscrowedSynthShares == 0
            ? token.balanceOf(address(this))
            : synthAmount;

        token.transfer(to, transferAmt);
    }

    function convertSharesToSynth(
        Data storage asyncOrderData,
        uint128 marketId,
        uint256 sharesAmount
    ) internal view returns (uint256) {
        uint currentSynthBalance = SynthUtil.getToken(marketId).balanceOf(address(this));
        return (sharesAmount * currentSynthBalance) / asyncOrderData.totalEscrowedSynthShares;
    }
}
