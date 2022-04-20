//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "../interfaces/IAccount.sol";

import "./account/AccountBase.sol";

contract Account is IAccount, AccountBase, UUPSImplementation, Ownable {
    using SetUtil for SetUtil.AddressSet;

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function delegateAccountPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) external override onlyOwnerOrAuthorized(account, Permission.Delegate) {
        _grantPermission(account, authorized, permission);
    }

    function revokeAccountPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) external override onlyOwnerOrAuthorized(account, Permission.Delegate) {
        _revokePermission(account, authorized, permission);
    }

    function getAccountDelegatedAddresses(uint256 account) external view override returns (address[] memory) {
        return _accountStore().delegatedAddresses[account].values();
    }

    function getAccountDelegatedAddressPackedPermissions(uint256 account, address authorized)
        external
        view
        override
        returns (uint32)
    {
        return _accountStore().delegatedPermissions[account][authorized];
    }

    // Business Interface
    struct collateralInfo {
        uint cType;
        uint amount;
        uint lockDuration;
        uint startLockingTime;
    }

    // array of assigned funds

    function stake(uint collateralType, uint collateralAmount) public {
        // adds a collateralInfo to the collaterals array
    }

    function totalCollateral(uint collateralType) public view returns (uint) {
        return 0;
    }

    function assignedCollateral(uint collateralType) public view returns (uint) {
        return 0;
    }

    function _getAssignedFunds(uint collateralType) public view returns (uint) {
        return 0;
    }
}

contract Fund {
    mapping(uint => positionInfo) public positions;

    struct positionInfo {
        uint accountId;
        uint collateralType;
        uint collateralAmount;
        uint leverage;
        uint initialDebt;
    }

    function adjust(
        uint accountId,
        uint collateralType,
        uint collateralAmount,
        uint leverage
    ) public {
        // require accountId can operate on collateralType

        if (positions[accountId].collateralAmount == 0) {
            // new position
        } else if (collateralAmount == 0) {
            // remove position
        } else if (positions[accountId].collateralAmount < collateralAmount) {
            // increase position
        } else if (positions[accountId].collateralAmount > collateralAmount) {
            // decrease position
        } else {
            // nop
        }
    }

    function getAccountCurrentDebt(uint accountId) public returns (uint) {
        return 0;
    }

    function accountShares(uint accountId) public returns (uint) {
        return 0;
    }

    function totalShares() public returns (uint) {
        return 0;
    }

    function totalDebt() public returns (uint) {
        return 0;
    }

    function accountDebt(uint accountId) public {
        return
            accountCollateralValue() +
            positions[accountId].initialDebt -
            totalDebt() *
            (accountShares(accountId) / totalShares());
    }

    function accountCollateralValue(uint accountId) public view returns (uint) {
        return positions[accountId].amount - positions[accountId].amount * token(accountEntry.collateralToken).value;
    }

    function getCRation(uint accountId) public view returns (uint) {
        return accountCollateralValue() / accountDebt(accountId);
    }

    function setMarkets(uint[] marketIds, uint[] weights) internal {}

    function _assignCollateralToMarket() internal {}
}
