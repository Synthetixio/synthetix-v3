//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface IFundModule is ISatelliteFactory {
    function initializeFundModule() external;

    function isFundModuleInitialized() external view returns (bool);

    function upgradeFundTokenImplementation(address newFundTokenImplementation) external;

    function getFundTokenAddress() external view returns (address);

    function getFundModuleSatellites() external view returns (Satellite[] memory);

    function nominateFundOwner(uint fundId, address owner) external;

    function acceptFundOwnership(uint fundId) external;

    function renounceFundOwnership(uint fundId) external;

    function createFund(uint requestedFundId, address owner) external;

    function setFundPosition(
        uint fundId,
        uint[] calldata markets,
        uint[] calldata weights
    ) external;

    function rebalanceMarkets(uint fundId) external;

    function delegateCollateral(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint exposure
    ) external;

    function mintsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    function burnsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    function collateralizationRatio(
        uint fundId,
        uint accountId,
        address collateralType
    ) external;

    function accountFundDebt(
        uint fundId,
        uint accountId,
        address collateralType
    ) external;

    function fundDebt(uint fundId) external;

    function totalDebtShares(uint fundId) external;

    function debtPerShare(uint fundId) external;
}
