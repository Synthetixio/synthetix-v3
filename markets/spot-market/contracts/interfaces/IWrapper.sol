//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "../storage/WrapperStorage.sol";

/// @title Spot Market Wrapper Interface
interface IWrapper {
    event WrapperInitialized(uint indexed synthMarketId, address collateralType, uint supplyCap);
    event WrapperSupplyUpdated(uint indexed synthMarketId, uint supplyCap);
    event SynthWrapped(uint indexed synthMarketId, uint amountWrapped, uint feesCollected);
    event SynthUnwrapped(uint indexed synthMarketId, uint amountUnwrapped, uint feesCollected);

    function initializeWrapper(uint supplyCap, address collateralType) external;

    function updateSupplyCap(uint supplyCap) external;

    function wrap(uint wrapAmount) external returns (uint);

    function unwrap(uint unwrapAmount) external returns (uint);

    function getWrapQuote(uint wrapAmount) external view returns (uint, uint);

    function getUnwrapQuote(uint unwrapAmount) external view returns (uint, uint);
}
