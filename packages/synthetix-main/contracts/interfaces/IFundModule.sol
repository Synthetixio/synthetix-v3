//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFundModule {
    function initializeFundModule() external;

    function isFundModuleInitialized() external view returns (bool);

    function adjust(
        uint fundId,
        uint accountId,
        address collateralType,
        uint collateralAmount,
        uint lockingPeriod,
        uint leverage
    ) external;

    function getAccountCurrentDebt(uint accountId) external returns (uint);

    function accountShares(uint accountId) external returns (uint);

    function totalShares() external returns (uint);

    function totalDebt() external returns (uint);

    function accountDebt(uint fundId, uint accountId) external returns (uint);

    function accountCollateralValue(uint accountId) external view returns (uint);

    function getCRation(uint fundId, uint accountId) external returns (uint);
}
