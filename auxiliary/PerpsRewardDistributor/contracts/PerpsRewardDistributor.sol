// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IPerpRewardDistributor} from "./interfaces/IPerpsRewardDistributor.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

contract PerpsRewardDistributor is IPerpRewardDistributor {
    string private constant _version = "1.0.0";

    bool private _initialized;

    address private _rewardManager; // synthetix
    address private _token;
    string private _name;

    uint128 private _poolId;
    address private _perpMarket;
    bool public shouldFailPayout;

    error AlreadyInitialized();
    error OnlyPerpMarket();
    error OnlyRewardManager();

    constructor() {
        // Should be initialized by the factory. This prevents usage of the instance without proper initialization
        _initialized = true;
    }

    /**
     * Initialize the contract
     * @notice This function should be called only once at clone node creation.
     * @notice it can be called only once by anyone (not checking sender)
     * @notice but will be created by the factory and initialized immediatly after creation, and consumed only if initialization succeeds
     * @param rewardManager address of the reward manager (Synthetix core proxy)
     * @param perpMarket address of the perp market
     * @param poolId poolId of the pool
     * @param token_ token address of the collateral
     * @param name_ rewards distribution name
     */
    function initialize(
        address rewardManager,
        address perpMarket,
        uint128 poolId,
        address token_,
        string memory name_
    ) external {
        if (_initialized) {
            revert AlreadyInitialized();
        }
        _rewardManager = rewardManager;
        _perpMarket = perpMarket;
        _poolId = poolId;
        _token = token_;
        _name = name_;
    }

    function distributeRewards(address collateralType, uint256 amount) external {
        onlyPerpMarket();
        IRewardsManagerModule(_rewardManager).distributeRewards(
            _poolId,
            collateralType,
            amount,
            uint64(block.timestamp), // solhint-disable-line numcast/safe-cast
            0
        );
    }

    function setShouldFailPayout(bool _shouldFailedPayout) external {
        onlyPerpMarket(); // perp market is in fact the owner
        shouldFailPayout = _shouldFailedPayout;
    }

    function payout(
        uint128 /* accountId */,
        uint128 /* poolId */,
        address /* collateralType */,
        address sender,
        uint256 amount
    ) external override returns (bool) {
        onlyRewardManager();
        IERC20(_token).transfer(sender, amount);
        return !shouldFailPayout;
    }

    function onPositionUpdated(
        uint128 /* accountId */,
        uint128 /* poolId */,
        address /* collateralType */,
        uint256 /* newShares */
    ) external pure override {}

    function token() external view override returns (address) {
        return _token;
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    function getPoolId() external view override returns (uint128) {
        return _poolId;
    }

    function version() external pure virtual override returns (string memory) {
        return _version;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IRewardDistributor).interfaceId ||
            interfaceId == type(IPerpRewardDistributor).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }

    function onlyPerpMarket() internal view {
        // solhint-disable-next-line meta-transactions/no-msg-sender
        if (msg.sender != _perpMarket) {
            revert OnlyPerpMarket();
        }
    }

    function onlyRewardManager() internal view {
        // solhint-disable-next-line meta-transactions/no-msg-sender
        if (msg.sender != _rewardManager) {
            revert OnlyRewardManager();
        }
    }
}
