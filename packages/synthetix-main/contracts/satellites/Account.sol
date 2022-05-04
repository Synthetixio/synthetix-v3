//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../interfaces/IAccount.sol";
import "../storage/AccountStorage.sol";

contract Account is IAccount, ERC721, AccountStorage, InitializableMixin, UUPSImplementation, Ownable {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;

    error InvalidAccountId(uint accountId);

    error InvalidRole(bytes32 role);

    error StakedCollateralAlreadyExists(address collateral, uint256 lockExpirationTime);
    error NotUnassignedCollateral();
    error InsufficientAvailableCollateral(uint accountId, address collateralType, uint requestedAmount);

    /////////////////////////////////////////////////
    // CHORES
    /////////////////////////////////////////////////

    function _isInitialized() internal view override returns (bool) {
        return _accountStore().initialized;
    }

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

    /////////////////////////////////////////////////
    // MINT
    /////////////////////////////////////////////////
    function mint(uint256 accountId, address owner) external override {
        _mint(owner, accountId);
    }

    /////////////////////////////////////////////////
    // STAKE  /  UNSTAKE
    /////////////////////////////////////////////////

    function stake(
        uint accountId,
        address collateral,
        uint256 amount
    ) public override {
        // TODO check if msg.sender is enabled to execute that operation for the accountID

        // TODO check if (this) is approved to collateral.transferFrom() the amount

        // TODO check the rest of the info of the callateral to stake

        AccountData storage accountData = _accountStore().accountsData[accountId];

        bytes32 collateralId = _calculateCollateralId(collateral);
        if (accountData.stakedCollaterals[collateralId].collateralType != address(0)) {
            // TODO What if the aim is to add collateral to the same staking
            revert StakedCollateralAlreadyExists(collateral, 0);
        }

        // TODO transfer collateral from accountId.owner to (this)

        // adds a collateralInfo to the collaterals array
        accountData.stakedCollateralIds.add(collateralId);
        accountData.stakedCollaterals[collateralId].collateralType = collateral;
        accountData.stakedCollaterals[collateralId].lockDuration = 0;
        accountData.stakedCollaterals[collateralId].lockExpirationTime = 0;
        accountData.stakedCollaterals[collateralId].amount = amount;
        accountData.stakedCollaterals[collateralId].assignedAmount = 0;
    }

    function unstake(
        uint accountId,
        address collateralType,
        uint amount
    ) public override {
        // TODO check if msg.sender is enabled to execute that operation for the accountID

        (uint256 collateral, uint256 unlockedCollateral, uint256 assignedCollateral) = getCollateralTotals(
            accountId,
            collateralType
        );

        if (assignedCollateral > collateral) {
            revert NotUnassignedCollateral();
        }

        if (collateral - assignedCollateral < amount || unlockedCollateral < amount) {
            revert InsufficientAvailableCollateral(accountId, collateralType, amount);
        }

        _unstake(accountId, collateralType, amount);
    }

    function _unstake(
        uint256 accountId,
        address collateralType,
        uint256 amount
    ) internal {
        AccountData storage accountData = _accountStore().accountsData[accountId];

        for (uint i = 1; i < accountData.stakedCollateralIds.length(); i++) {
            StakedCollateral storage stakedCollateral = accountData.stakedCollaterals[
                accountData.stakedCollateralIds.valueAt(i)
            ];
            if (stakedCollateral.collateralType == collateralType && _notLocked(stakedCollateral)) {
                if (stakedCollateral.amount - stakedCollateral.assignedAmount < amount) {
                    // remove that amount from the collateral and keep looking on other entries.
                    amount = amount - stakedCollateral.amount;
                } else {
                    amount = 0;
                }
                stakedCollateral.amount = stakedCollateral.amount - amount;
                if (amount == 0) {
                    break;
                }
            }
        }

        if (amount > 0) {
            // should not happen because we checked before...
            revert InsufficientAvailableCollateral(accountId, collateralType, amount);
        }

        // TODO emit an event

        // TODO transfer collateral from (this) to accountId.owner
    }

    /////////////////////////////////////////////////
    // ROLES
    /////////////////////////////////////////////////
    function hasRole(
        uint accountId,
        bytes32 role,
        address target
    ) public view override returns (bool) {
        AccountData storage accountData = _accountStore().accountsData[accountId];

        return target != address(0) && accountData.delegations[target].contains(role);
    }

    function grantRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override {
        if (target == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (role == 0) {
            revert InvalidRole(role);
        }

        AccountData storage accountData = _accountStore().accountsData[accountId];

        accountData.delegations[target].add(role);
    }

    function revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override {
        AccountData storage accountData = _accountStore().accountsData[accountId];

        accountData.delegations[target].remove(role);
    }

    function renounceRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override {}

    /////////////////////////////////////////////////
    // FUND ASSIGN  /  UNASSIGN
    /////////////////////////////////////////////////
    function assign(
        uint accountId,
        address fund,
        StakedCollateral calldata collateral,
        uint amount
    ) public {}

    function unassign(
        uint accountId,
        address fund,
        StakedCollateral calldata collateral,
        uint amount
    ) public {}

    /////////////////////////////////////////////////
    // STATS
    /////////////////////////////////////////////////

    function getCollateralTotals(uint accountId, address collateralType)
        public
        view
        returns (
            uint,
            uint,
            uint
        )
    {
        AccountData storage accountData = _accountStore().accountsData[accountId];
        uint256 collateral;
        uint256 unlockedCollateral;
        uint256 assignedCollateral;

        for (uint i = 1; i < accountData.stakedCollateralIds.length(); i++) {
            StakedCollateral storage stakedCollateral = accountData.stakedCollaterals[
                accountData.stakedCollateralIds.valueAt(i)
            ];
            if (stakedCollateral.collateralType == collateralType) {
                collateral = collateral + stakedCollateral.amount;
                assignedCollateral = assignedCollateral + stakedCollateral.assignedAmount;
                if (_notLocked(stakedCollateral)) {
                    unlockedCollateral = unlockedCollateral + stakedCollateral.amount;
                }
            }
        }

        return (collateral, unlockedCollateral, assignedCollateral);
    }

    /////////////////////////////////////////////////
    // INTERNALS
    /////////////////////////////////////////////////

    function _calculateCollateralId(StakedCollateral calldata collateral) internal view returns (bytes32) {
        return _calculateCollateralId(collateral.collateralType, collateral.lockExpirationTime);
    }

    function _calculateCollateralId(address collateralType) internal view returns (bytes32) {
        return _calculateCollateralId(collateralType, 0);
    }

    function _calculateCollateralId(address collateralType, uint256 lockExpirationTime) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(collateralType, lockExpirationTime));
    }

    function _notLocked(StakedCollateral storage collateral) internal view returns (bool) {
        // TODO implement the logic
        return false;
    }
}
