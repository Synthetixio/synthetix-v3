//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// https://docs.synthetix.io/contracts/source/interfaces/isynthetixdebtshare
interface ISynthetixDebtShare {
    // Views

    function currentPeriodId() external view returns (uint128);

    function allowance(address account, address spender) external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function balanceOfOnPeriod(address account, uint256 periodId) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function sharePercent(address account) external view returns (uint256);

    function sharePercentOnPeriod(
        address account,
        uint256 periodId
    ) external view returns (uint256);

    // Mutative functions

    function takeSnapshot(uint128 id) external;

    function mintShare(address account, uint256 amount) external;

    function burnShare(address account, uint256 amount) external;

    function approve(address, uint256) external pure returns (bool);

    function transfer(address to, uint256 amount) external pure returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function addAuthorizedBroker(address target) external;

    function removeAuthorizedBroker(address target) external;

    function addAuthorizedToSnapshot(address target) external;

    function removeAuthorizedToSnapshot(address target) external;
}
