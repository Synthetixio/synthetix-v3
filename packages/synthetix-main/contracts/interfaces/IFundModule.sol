//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

/// @title Module for managing funds and assignments per account
interface IFundModule is ISatelliteFactory {
    /// @notice initializes the FundModule. Creates the FundToken proxy and first implementation.
    function initializeFundModule() external;

    /// @notice shows whether the module has been initialized
    function isFundModuleInitialized() external view returns (bool);

    /// @notice upgrades the AFundToken implementation.
    function upgradeFundTokenImplementation(address newFundTokenImplementation) external;

    /// @notice gets the FundToken address.
    function getFundTokenAddress() external view returns (address);

    /// @notice gets the FundModule Satellites created (only one, at idx 0).
    function getFundModuleSatellites() external view returns (Satellite[] memory);

    /// @notice SCCP sets the preferred fund
    function setPreferredFund(uint fundId) external;

    /// @notice SCCP adds a fundId to the approved list
    function addApprovedFund(uint fundId) external;

    /// @notice SCCP removes a fundId to the approved list
    function removeApprovedFund(uint fundId) external;

    /// @notice gets the preferred fund
    function getPreferredFund() external view returns (uint);

    /// @notice gets the approved funds (list of fundIds)
    function getApprovedFunds() external view returns (uint[] calldata);

    /// @notice creates a new fundToken (NFT)
    function createFund(uint requestedFundId, address owner) external;

    /// @notice sets the fund positions (only fundToken owner)
    function setFundPosition(
        uint fundId,
        uint[] calldata markets,
        uint[] calldata weights
    ) external;

    /// @notice gets the fund positions
    function getFundPosition(uint fundId) external view returns (uint[] memory markets, uint[] memory weights);

    /// @notice external access to rebalanceMarkets
    function rebalanceMarkets(uint fundId) external; // TODO Maybe is internal

    /// @notice delegates (creates, adjust or remove a delegation) collateral from an account
    function delegateCollateral(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) external;

    /// @notice mints sUSD for a fund/account from a collateralType. if CRatio is valid
    function mintsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    /// @notice burns sUSD for a fund/account from a collateralType
    function burnsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    /// @notice gets the CRatio for an account/collateral in a fund
    function collateralizationRatio(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view returns (uint);

    /// @notice gets the account debt in a fund for a collateral
    function accountFundDebt(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view returns (uint);

    /// @notice gets the account collateral value in a fund for a collateral
    function accountFundCollateralValue(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view returns (uint);

    // TODO Everything below this line should be split per collateralType
    // according to May 23th discussion Funds should be "single" collateral

    /// @notice gets the total fund debt
    function fundDebt(uint fundId) external view returns (uint);

    /// @notice gets the total fund debtShares
    function totalDebtShares(uint fundId) external view returns (uint);

    /// @notice gets the debt per share (sUSD value) for a fund
    function debtPerShare(uint fundId) external view returns (uint);
}
