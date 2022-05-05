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

    /////////////////////////////////////////////////
    // ERRORS
    /////////////////////////////////////////////////
    error InvalidAccountId(uint accountId);

    error InvalidRole(bytes32 role);
    error NotAuthorized(uint accountId, bytes32 role, address target);

    error StakedCollateralAlreadyExists(address collateral, uint256 lockExpirationTime);
    error NotUnassignedCollateral();
    error InsufficientAvailableCollateral(uint accountId, address collateralType, uint requestedAmount);
    error OutOfBounds();

    /////////////////////////////////////////////////
    // EVENTS
    /////////////////////////////////////////////////
    event AccountMinted(uint accountId, address owner);

    event CollateralStaked(uint accountId, address collateral, uint amount, address executedBy);
    event CollateralUnstaked(uint accountId, address collateral, uint amount, address executedBy);

    event RoleGranted(uint accountId, bytes32 role, address target, address executedBy);
    event RoleRevoked(uint accountId, bytes32 role, address target, address executedBy);

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
    function mint(address owner, uint256 accountId) external override {
        _mint(owner, accountId);

        emit AccountMinted(owner, accountId);
    }

    /////////////////////////////////////////////////
    // STAKE  /  UNSTAKE
    /////////////////////////////////////////////////

    function stake(
        uint accountId,
        address collateral,
        uint256 amount
    ) public override onlyAuthorized(accountId, "stake") {
        // TODO check if (this) is approved to collateral.transferFrom() the amount

        // TODO check the rest of the info of the callateral to stake

        AccountData storage accountData = _accountStore().accountsData[accountId];

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
    ) public override onlyAuthorized(accountId, "unstake") {
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
    // FUND ASSIGN  /  UNASSIGN
    /////////////////////////////////////////////////
    function assign(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) public onlyAuthorized(accountId, "assignFund") {}

    function unassign(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) public onlyAuthorized(accountId, "unassignFund") {}

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
    ) external override onlyAuthorized(accountId, "modifyPermission") {
        if (target == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (role == "") {
            revert InvalidRole(role);
        }

        AccountData storage accountData = _accountStore().accountsData[accountId];

        accountData.delegations[target].add(role);

        emit RoleGranted(accountId, role, target, msg.sender);
    }

    function revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override onlyAuthorized(accountId, "modifyPermission") {
        _revokeRole(accountId, role, target);
    }

    function renounceRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override {
        if (msg.sender != target) {
            revert NotAuthorized(accountId, "renounceRole", target);
        }

        _revokeRole(accountId, role, target);
    }

    function _revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) internal {
        AccountData storage accountData = _accountStore().accountsData[accountId];

        accountData.delegations[target].remove(role);

        emit RoleRevoked(accountId, role, target, msg.sender);
    }

    modifier onlyAuthorized(uint accountId, bytes32 role) {
        AccountData storage accountData = _accountStore().accountsData[accountId];
        address msgSender = msg.sender;

        // msgSender is owner => go ahead
        // msgSender has role 'owner' => go ahead
        // msgSender has role role => go ahead
        // otherwise revert as not authorized
        if (
            (msgSender != accountData.owner) &&
            (!hasRole(accountId, "owner", msgSender)) &&
            (!hasRole(accountId, role, msgSender))
        ) {
            revert NotAuthorized(accountId, role, msgSender);
        }

        _;
    }

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
        StakedCollateralData storage stakedCollateral = _accountStore().accountsData[accountId].stakedCollateralsData[
            collateralType
        ];
        uint256 total = stakedCollateral.amount;
        uint256 assigned = stakedCollateral.assignedAmount;
        uint256 locked = _getTotalLocked(stakedCollateral.locks);

        return (total, locked, assigned);
    }

    function getUnstakableCollateral(uint accountId, address collateralType) public view returns (uint) {
        (total, locked, assigned) = getCollateralTotals(accountId, collateralType);

        if (locked > assigned) {
            return total - locked;
        }

        return total - assigned;
    }

    function getUnstakableCollateral(uint accountId, address collateralType) public view returns (uint) {
        (total, locked, assigned) = getCollateralTotals(accountId, collateralType);

        return total - assigned;
    }

    /////////////////////////////////////////////////
    // UTILS
    /////////////////////////////////////////////////
    function cleanExpiredLockes(
        uint accountId,
        address collateralType,
        uint offset,
        uint items
    ) external {
        _cleanExpiredLockes(
            _accountStore().accountsData[accountId].stakedCollateralsData[collateralType].locks,
            offset,
            items
        );
    }

    /////////////////////////////////////////////////
    // INTERNALS
    /////////////////////////////////////////////////
    function _getTotalLocked(StakedCollateralLock[] locks) internal view returns (uint) {
        uint64 currentTime = uint64(block.timestamp);
        uint256 locked;

        for (uint i = 0; i < locks.length; i++) {
            if (locks[i].lockExpirationTime > currentTime) {
                locked += locks[i].amount;
            }
        }
        return locked;
    }

    // TODO this can be part of core-contract utils
    function _cleanExpiredLockes(
        StakedCollateralLock[] locks,
        uint offset,
        uint items
    ) internal {
        if (offset > locks.length || items > locks.length) {
            revert OutOfBounds();
        }

        uint64 currentTime = uint64(block.timestamp);

        if (offset == 0 && items == 0) {
            // not specified, use all array
            items = locks.length;
        }

        uint index = offset;
        while (index < locks.length) {
            if (locks[index].lockExpirationTime <= currentTime) {
                // remove item
                locks[index] = locks[locks.length - 1];
                locks.pop();
            } else {
                index++;
            }
        }
    }
}
