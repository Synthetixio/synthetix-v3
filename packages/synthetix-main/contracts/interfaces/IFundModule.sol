//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface IFundModule is ISatelliteFactory {
    function initializeFundModule() external;

    function isFundModuleInitialized() external view returns (bool);

    function upgradeFundTokenImplementation(address newFundTokenImplementation) external;

    function getFundTokenAddress() external view returns (address);

    function getFundModuleSatellites() external view returns (Satellite[] memory);

    function mintFund(uint requestedFundId, address owner) external;

    /// @notice creates a new accountToken (NFT)
    function transferFund(address to, uint256 fundId) external;

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
        uint leverage
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
    ) external view returns (uint);

    function accountFundDebt(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view returns (uint);

    function accountFundCollateralValue(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view returns (uint);

    function fundDebt(uint fundId) external view returns (uint);

    function totalDebtShares(uint fundId) external view returns (uint);

    function debtPerShare(uint fundId) external view returns (uint);

    function setPreferredFund(uint fundId) external;

    function getPreferredFund() external view returns (uint);

    function addApprovedFund(uint fundId) external;

    function removeApprovedFund(uint fundId) external;

    function getApprovedFunds() external view returns (uint[] calldata);
}
