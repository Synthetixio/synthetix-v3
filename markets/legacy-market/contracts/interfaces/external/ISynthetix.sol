//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

// https://docs.synthetix.io/contracts/source/interfaces/isynthetix
interface ISynthetix is IERC20 {
    // Views
    function anySynthOrSNXRateIsInvalid() external view returns (bool anyRateInvalid);

    function availableCurrencyKeys() external view returns (bytes32[] memory);

    function availableSynthCount() external view returns (uint256);

    function collateral(address account) external view returns (uint256);

    function collateralisationRatio(address issuer) external view returns (uint256);

    function debtBalanceOf(address issuer, bytes32 currencyKey) external view returns (uint256);

    function isWaitingPeriod(bytes32 currencyKey) external view returns (bool);

    function maxIssuableSynths(address issuer) external view returns (uint256 maxIssuable);

    function remainingIssuableSynths(
        address issuer
    ) external view returns (uint256 maxIssuable, uint256 alreadyIssued, uint256 totalSystemDebt);

    function synthsByAddress(address synthAddress) external view returns (bytes32);

    function totalIssuedSynths(bytes32 currencyKey) external view returns (uint256);

    function totalIssuedSynthsExcludeOtherCollateral(
        bytes32 currencyKey
    ) external view returns (uint256);

    function transferableSynthetix(address account) external view returns (uint256 transferable);

    function getFirstNonZeroEscrowIndex(address account) external view returns (uint256);

    // Mutative Functions
    function burnSynths(uint256 amount) external;

    function burnSynthsOnBehalf(address burnForAddress, uint256 amount) external;

    function burnSynthsToTarget() external;

    function burnSynthsToTargetOnBehalf(address burnForAddress) external;

    function exchange(
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey
    ) external returns (uint256 amountReceived);

    function exchangeOnBehalf(
        address exchangeForAddress,
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey
    ) external returns (uint256 amountReceived);

    function exchangeWithTracking(
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey,
        address rewardAddress,
        bytes32 trackingCode
    ) external returns (uint256 amountReceived);

    function exchangeWithTrackingForInitiator(
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey,
        address rewardAddress,
        bytes32 trackingCode
    ) external returns (uint256 amountReceived);

    function exchangeOnBehalfWithTracking(
        address exchangeForAddress,
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey,
        address rewardAddress,
        bytes32 trackingCode
    ) external returns (uint256 amountReceived);

    function exchangeAtomically(
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey,
        bytes32 trackingCode,
        uint256 minAmount
    ) external returns (uint256 amountReceived);

    function issueMaxSynths() external;

    function issueMaxSynthsOnBehalf(address issueForAddress) external;

    function issueSynths(uint256 amount) external;

    function issueSynthsOnBehalf(address issueForAddress, uint256 amount) external;

    function mint() external returns (bool);

    function settle(
        bytes32 currencyKey
    ) external returns (uint256 reclaimed, uint256 refunded, uint256 numEntries);

    // Liquidations
    function liquidateDelinquentAccount(address account) external returns (bool);

    function liquidateDelinquentAccountEscrowIndex(
        address account,
        uint256 escrowStartIndex
    ) external returns (bool);

    function liquidateSelf() external returns (bool);

    // Restricted Functions

    function mintSecondary(address account, uint256 amount) external;

    function mintSecondaryRewards(uint256 amount) external;

    function burnSecondary(address account, uint256 amount) external;

    function migrateAccountBalances(
        address account
    ) external returns (uint256 totalEscrowRevoked, uint256 totalLiquidBalance);
}
