//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IPerpCollateralModule {
    // --- Events --- //

    // @dev Emitted when collateral is transferred between user <-> Account.
    event Transfer(address indexed from, address indexed to, int256 value);

    // --- Mutative --- //

    /**
     * @dev Transfers an accepted `collateral` from msg.sender to `accountId`.
     *
     * A negative `amountDelta` is a withdraw. A variety of errors are thrown if limits or collateral
     * issues are found. A transfer, even when there is no open position will immediately deposit the
     * collateral into the Synthetix core system.
     *
     * There are no fees associated with the transfer of collateral.
     */
    function transferTo(uint128 accountId, uint128 marketId, address collateral, int256 amountDelta) external;
}
