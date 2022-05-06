//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

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

    error CollateralAlreadyExists(address collateralType);
    error InvalidCollateralType(address collateralType);
    error NotUnassignedCollateral();
    error InsufficientAvailableCollateral(uint accountId, address collateralType, uint requestedAmount);
    error OutOfBounds();

    /////////////////////////////////////////////////
    // EVENTS
    /////////////////////////////////////////////////
    event AccountMinted(address owner, uint accountId);

    event CollateralAdded(address collateralType, address priceFeed, uint targetCRatio, uint minimumCRatio);
    event CollateralAdjusted(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool disabled
    );

    event CollateralStaked(uint accountId, address collateralType, uint amount, address executedBy);
    event CollateralUnstaked(uint accountId, address collateralType, uint amount, address executedBy);

    event RoleGranted(uint accountId, bytes32 role, address target, address executedBy);
    event RoleRevoked(uint accountId, bytes32 role, address target, address executedBy);

    /////////////////////////////////////////////////
    // CHORES
    /////////////////////////////////////////////////

    function _isInitialized() internal view override returns (bool) {
        return _accountStore().initialized;
    }

    function isAccountInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);
        _accountStore().initialized = true;
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
    // SCCP ADD/REMOVE COLLATERAL TYPE
    /////////////////////////////////////////////////
    function addCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio
    ) external override onlyOwner {
        if (_accountStore().collaterals.contains(collateralType)) {
            revert CollateralAlreadyExists(collateralType);
        }

        _accountStore().collaterals.add(collateralType);

        _accountStore().collateralsData[collateralType].targetCRatio = targetCRatio;
        _accountStore().collateralsData[collateralType].minimumCRatio = minimumCRatio;
        _accountStore().collateralsData[collateralType].priceFeed = priceFeed;
        _accountStore().collateralsData[collateralType].disabled = false;

        emit CollateralAdded(collateralType, priceFeed, targetCRatio, minimumCRatio);
    }

    function adjustCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool disabled
    ) external override onlyOwner {
        if (!_accountStore().collaterals.contains(collateralType)) {
            revert InvalidCollateralType(collateralType);
        }

        _accountStore().collateralsData[collateralType].targetCRatio = targetCRatio;
        _accountStore().collateralsData[collateralType].minimumCRatio = minimumCRatio;
        _accountStore().collateralsData[collateralType].priceFeed = priceFeed;
        _accountStore().collateralsData[collateralType].disabled = disabled;

        emit CollateralAdjusted(collateralType, priceFeed, targetCRatio, minimumCRatio, disabled);
    }

    function getCollateralTypes() external view override returns (address[] memory) {
        return _accountStore().collaterals.values();
    }

    function getCollateralType(address collateralType)
        external
        view
        override
        returns (
            address,
            uint,
            uint,
            bool
        )
    {
        CollateralData storage collateral = _accountStore().collateralsData[collateralType];
        return (collateral.priceFeed, collateral.targetCRatio, collateral.minimumCRatio, collateral.disabled);
    }

    /////////////////////////////////////////////////
    // STAKE  /  UNSTAKE
    /////////////////////////////////////////////////

    function stake(
        uint accountId,
        address collateralType,
        uint256 amount
    ) public override onlyAuthorized(accountId, "stake") {
        if (
            !_accountStore().collaterals.contains(collateralType) || _accountStore().collateralsData[collateralType].disabled
        ) {
            revert InvalidCollateralType(collateralType);
        }

        // TODO check if (this) is approved to collateral.transferFrom() the amount

        // TODO check the rest of the info of the callateral to stake

        StakedCollateralData storage collateralData = _accountStore().accountsData[accountId].stakedCollateralsData[
            collateralType
        ];

        // TODO Use SafeTransferFrom
        IERC20(collateralType).transferFrom(ownerOf(accountId), address(this), amount);

        if (!collateralData.set) {
            // new collateral
            collateralData.set = true;
            collateralData.amount = amount;
        } else {
            collateralData.amount += amount;
        }

        emit CollateralStaked(accountId, collateralType, amount, msg.sender);
    }

    function unstake(
        uint accountId,
        address collateralType,
        uint amount
    ) public override onlyAuthorized(accountId, "unstake") {
        uint256 availableCollateral = getFreeCollateral(accountId, collateralType);

        if (availableCollateral < amount) {
            revert InsufficientAvailableCollateral(accountId, collateralType, amount);
        }

        StakedCollateralData storage collateralData = _accountStore().accountsData[accountId].stakedCollateralsData[
            collateralType
        ];

        collateralData.amount -= amount;

        emit CollateralUnstaked(accountId, collateralType, amount, msg.sender);

        // TODO Use SafeTransfer
        IERC20(collateralType).transfer(ownerOf(accountId), amount);
    }

    /////////////////////////////////////////////////
    // FUND ASSIGN  /  UNASSIGN
    /////////////////////////////////////////////////
    function assign(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) public override onlyAuthorized(accountId, "assignFund") {
        if (
            !_accountStore().collaterals.contains(collateralType) || _accountStore().collateralsData[collateralType].disabled
        ) {
            revert InvalidCollateralType(collateralType);
        }

        uint256 availableCollateral = getFreeCollateral(accountId, collateralType);

        if (availableCollateral < amount) {
            revert InsufficientAvailableCollateral(accountId, collateralType, amount);
        }

        StakedCollateralData storage collateralData = _accountStore().accountsData[accountId].stakedCollateralsData[
            collateralType
        ];

        collateralData.assignedAmount += amount;

        // TODO add to assigned funds
        _accountStore().accountsData[accountId].subscribedFunds.push(fundId);

        // TODO emit an event
    }

    function unassign(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) public override onlyAuthorized(accountId, "unassignFund") {
        // TODO Some validity checks

        // TODO is enough assigned collateral?

        // TODO is enough collateral to unassign
        StakedCollateralData storage collateralData = _accountStore().accountsData[accountId].stakedCollateralsData[
            collateralType
        ];

        collateralData.assignedAmount -= amount;

        // TODO remove from assigned funds if not more assigned
        _accountStore().accountsData[accountId].subscribedFunds.push(fundId);

        // TODO emit an event
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

        return target != address(0) && accountData.permissions[target].contains(role);
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

        if (!accountData.permissionAddresses.contains(target)) {
            accountData.permissionAddresses.add(target);
        }

        accountData.permissions[target].add(role);

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

        accountData.permissions[target].remove(role);

        if (accountData.permissions[target].length() == 0) {
            accountData.permissionAddresses.remove(target);
        }

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
            (msgSender != ownerOf(accountId)) &&
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
        override
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

    function getFreeCollateral(uint accountId, address collateralType) public view override returns (uint) {
        (uint256 total, uint256 locked, uint256 assigned) = getCollateralTotals(accountId, collateralType);

        if (locked > assigned) {
            return total - locked;
        }

        return total - assigned;
    }

    function getUnassignedCollateral(uint accountId, address collateralType) public view override returns (uint) {
        (uint256 total, , uint256 assigned) = getCollateralTotals(accountId, collateralType);

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
    function _getTotalLocked(StakedCollateralLock[] storage locks) internal view returns (uint) {
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
        StakedCollateralLock[] storage locks,
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
