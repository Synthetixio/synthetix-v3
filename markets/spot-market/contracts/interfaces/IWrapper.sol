//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Spot Market Wrapper Interface
interface IWrapper {
    error InsufficientFunds();
    error InsufficientAllowance(uint expected, uint current);

    event WrapperInitialized(uint indexed synthMarketId, address collateralType);
    event SynthWrapped(uint indexed synthMarketId, int amountWrapped, uint feesCollected);
    event SynthUnwrapped(uint indexed synthMarketId, int amountUnwrapped, uint feesCollected);

    function initializeWrapper(uint128 marketId, address collateralType) external;

    function wrap(uint128 marketId, uint wrapAmount) external returns (int);

    function unwrap(uint128 marketId, uint unwrapAmount) external returns (int);
}
