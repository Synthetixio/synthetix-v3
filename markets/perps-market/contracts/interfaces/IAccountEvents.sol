//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Account events used on several places in the system.
 */
interface IAccountEvents {
    /**
     * @notice Gets fired when some collateral is deducted from the account for paying fees or liquidations.
     * @param account Id of the account being deducted.
     * @param collateralId Id of the collateral (synth) deducted.
     * @param amount Amount of synth market deducted from the account.
     */
    event CollateralDeducted(uint256 account, uint128 collateralId, uint256 amount);
}
