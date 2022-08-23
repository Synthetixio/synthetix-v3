//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/FundMixin.sol";

import "../../utils/SharesLibrary.sol";

import "../../storage/FundVaultStorage.sol";
import "../../interfaces/IVaultModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

import "../../submodules/FundEventAndErrors.sol";

contract VaultModule is
    IVaultModule,
    FundVaultStorage,
    FundEventAndErrors,
    AccountRBACMixin,
    OwnableMixin,
    AssociatedSystemsMixin,
    FundMixin
{
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;

    using SharesLibrary for SharesLibrary.Distribution;

    bytes32 private constant _USD_TOKEN = "USDToken";

    error InvalidLeverage(uint leverage);
    error InsufficientCollateralRatio(uint collateralValue, uint debt, uint ratio, uint minRatio);
    error InsufficientDebt(int currentDebt);

    function delegateCollateral(
        uint accountId,
        uint fundId,
        address collateralType,
        uint collateralAmount,
        uint leverage
    ) external override onlyRoleAuthorized(accountId, "assign") collateralEnabled(collateralType) fundExists(fundId) {
        // Fix leverage to 1 until it's enabled
        // TODO: we will probably at least want to test <1 leverage
        if (leverage != MathUtil.UNIT) revert InvalidLeverage(leverage);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        _updateAvailableRewards(vaultData, accountId);

        LiquidityItem storage liquidityItem = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        // get the current collateral situation
        (uint oldCollateralAmount, , ) = _accountCollateral(accountId, fundId, collateralType);

        // if increasing collateral additionally check they have enough collateral
        if (
            collateralAmount > oldCollateralAmount &&
            _getAccountUnassignedCollateral(accountId, collateralType) < collateralAmount - oldCollateralAmount
        ) {
            revert InsufficientAccountCollateral(accountId, collateralType, collateralAmount);
        }

        // stack too deep after this
        {
            // if decreasing collateral additionally check they have sufficient c-ratio

            _distributeVaultDebt(fundId, collateralType);

            uint shares = _calculateShares(vaultData, collateralAmount, leverage);

            // prevent users from specifying an infitesimly small amount such that they don't get any shares
            if (shares == 0 && collateralAmount > 0) {
                revert InvalidParameters("amount", "must be large enough for 1 share");
            }

            liquidityItem.cumulativeDebt += int128(vaultData.debtDist.updateDistributionActor(bytes32(accountId), shares));

            vaultData.totalCollateral = uint128(vaultData.totalCollateral + collateralAmount - oldCollateralAmount);

            liquidityItem.leverage = uint128(leverage);

            // this will ensure the new distribution information is passed up the chain to the markets
            _updateAccountDebt(accountId, fundId, collateralType);

            // this is the most efficient time to check the resulting collateralization ratio, since
            // user's debt and collateral price have been fully updated
            if (collateralAmount < oldCollateralAmount) {
                int debt = int(liquidityItem.cumulativeDebt) + int128(liquidityItem.usdMinted);

                _verifyCollateralRatio(
                    collateralType,
                    debt < 0 ? 0 : uint(debt),
                    collateralAmount.mulDecimal(vaultData.collateralPrice)
                );
            }
        }

        emit DelegationUpdated(
            _getLiquidityItemId(accountId, fundId, collateralType),
            accountId,
            fundId,
            collateralType,
            collateralAmount,
            leverage
        );
    }

    function _calculateShares(
        VaultData storage vaultData,
        uint collateralAmount,
        uint leverage
    ) internal view returns (uint) {
        uint totalCollateral = vaultData.totalCollateral;
        if (totalCollateral == 0) {
            return collateralAmount.mulDecimal(leverage);
        }

        return leverage.mulDecimal((uint(vaultData.debtDist.totalShares) * collateralAmount) / totalCollateral);
    }

    function _calculateInitialDebt(uint collateralValue, uint leverage) internal pure returns (uint) {
        return collateralValue.mulDecimal(leverage);
    }

    // ---------------------------------------
    // Mint/Burn USD
    // ---------------------------------------

    function mintUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "mint") {
        // check if they have sufficient c-ratio to mint that amount
        int debt = _updateAccountDebt(accountId, fundId, collateralType);

        (uint collateralValue, , ) = _accountCollateral(accountId, fundId, collateralType);

        int newDebt = debt + int(amount);

        if (newDebt > 0) {
            _verifyCollateralRatio(collateralType, uint(newDebt), collateralValue);
        }

        _fundVaultStore().liquidityItems[_getLiquidityItemId(accountId, fundId, collateralType)].usdMinted += uint128(
            amount
        );

        _getToken(_USD_TOKEN).mint(msg.sender, amount);
    }

    function burnUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override {
        int debt = _updateAccountDebt(accountId, fundId, collateralType);

        if (debt < 0) {
            // user shouldn't be able to burn more usd if they already have negative debt
            revert InsufficientDebt(debt);
        }

        LiquidityItem storage li = _fundVaultStore().liquidityItems[_getLiquidityItemId(accountId, fundId, collateralType)];

        if (debt < int(amount)) {
            amount = uint(debt);
        }

        // pay off usdMinted first (order doesn't really matter since it all becomes debt anyway)

        if (li.usdMinted > amount) {
            li.usdMinted -= uint128(amount);
        } else {
            li.cumulativeDebt -= int128(int(amount)) - int128(li.usdMinted);
            li.usdMinted = 0;
        }

        _getToken(_USD_TOKEN).burn(msg.sender, amount);
    }

    // ---------------------------------------
    // CRatio and Debt queries
    // ---------------------------------------

    function accountCollateralRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override returns (uint) {
        return _accountCollateralRatio(fundId, accountId, collateralType);
    }

    function accountVaultCollateral(
        uint accountId,
        uint fundId,
        address collateralType
    )
        external
        view
        override
        returns (
            uint amount,
            uint value,
            uint shares
        )
    {
        return _accountCollateral(accountId, fundId, collateralType);
    }

    function accountVaultDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override returns (int) {
        return _updateAccountDebt(accountId, fundId, collateralType);
    }

    function vaultCollateral(uint fundId, address collateralType) public override returns (uint amount, uint value) {
        amount = _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
        value = amount.mulDecimal(_getCollateralValue(collateralType));
    }

    function vaultDebt(uint fundId, address collateralType) public override returns (int) {
        _distributeVaultDebt(fundId, collateralType);

        return _fundVaultStore().fundVaults[fundId][collateralType].totalDebt;
    }

    function totalVaultShares(uint fundId, address collateralType) external view override returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].debtDist.totalShares;
    }

    function debtPerShare(uint fundId, address collateralType) external override returns (int) {
        _distributeVaultDebt(fundId, collateralType);

        return
            _fundVaultStore().fundVaults[fundId][collateralType].totalDebt /
            int128(_fundVaultStore().fundVaults[fundId][collateralType].debtDist.totalShares);
    }

    function _verifyCollateralRatio(
        address collateralType,
        uint debt,
        uint collateralValue
    ) internal view {
        uint targetCratio = _getCollateralTargetCRatio(collateralType);

        if (debt != 0 && collateralValue.divDecimal(debt) < targetCratio) {
            revert InsufficientCollateralRatio(collateralValue, debt, collateralValue.divDecimal(debt), targetCratio);
        }
    }

    // ---------------------------------------
    // Views
    // ---------------------------------------

    function getLiquidityItem(bytes32 liquidityItemId) public view override returns (LiquidityItem memory liquidityItem) {
        return _fundVaultStore().liquidityItems[liquidityItemId];
    }
}
