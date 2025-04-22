//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./interfaces/IStakingRewards.sol";

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

/* solhint-disable numcast/safe-cast */

/**
 * @notice Fork of Synthetix v2x StakingRewards contract which has been modified to:
 * * not require reward tokens to be deposited initially
 * * only pay out reward tokens after the measurement period has elapsed
 * * have a rollout of rewarded tokens
 * * use ERC2771 msgSender to be compatible with multicalls
 *
 * usage instructions:
 * 1. deploy contract
 * 2. owner calls `setRewardsDuration` to set how long it should take for rewards to come out
 * 3. owner calls `notifyRewardAmount` to set how much rewards there will be when the duration is over
 * 4. owner calls `setRewardsVestTime` to set amount of time after duration has completed to distribute tokens over
 * 5. owner sends reward tokens to contract before users withdraw from the pool
 * NOTE: this contract is single-use, and not indended to be reused after the initial period has passed
 */
contract TreasuryStakingRewards is IStakingRewards, Ownable {
    using DecimalMath for uint256;

    /* ========== STATE VARIABLES ========== */

    address public rewardsToken;
    address public stakingToken;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 7 days;
    uint256 public rewardsVestTime = 30 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public paidRewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _rewardsToken,
        address _stakingToken
    ) Ownable(ERC2771Context._msgSender()) {
        rewardsToken = _rewardsToken;
        stakingToken = _stakingToken;
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return
            _balances[account].mulDecimal(rewardPerToken() - userRewardPerTokenPaid[account]) +
            rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount) external updateReward(ERC2771Context._msgSender()) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply + amount;
        _balances[ERC2771Context._msgSender()] = _balances[ERC2771Context._msgSender()] + amount;
        IERC20(stakingToken).transferFrom(ERC2771Context._msgSender(), address(this), amount);
        emit Staked(ERC2771Context._msgSender(), amount);
    }

    function withdraw(uint256 amount) public updateReward(ERC2771Context._msgSender()) {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply - amount;
        _balances[ERC2771Context._msgSender()] = _balances[ERC2771Context._msgSender()] - amount;
        IERC20(stakingToken).transfer(ERC2771Context._msgSender(), amount);
        emit Withdrawn(ERC2771Context._msgSender(), amount);
    }

    function getReward() public updateReward(ERC2771Context._msgSender()) {
        if (block.timestamp < periodFinish) {
            return;
        }

        uint256 vestableReward = (rewards[ERC2771Context._msgSender()] *
            (block.timestamp - periodFinish)) /
            rewardsVestTime -
            paidRewards[ERC2771Context._msgSender()];
        if (vestableReward > 0) {
            paidRewards[ERC2771Context._msgSender()] += vestableReward;
            IERC20(rewardsToken).transfer(ERC2771Context._msgSender(), vestableReward);
            emit RewardPaid(ERC2771Context._msgSender(), vestableReward);
        }
    }

    function exit() external {
        withdraw(_balances[ERC2771Context._msgSender()]);
        getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward) external onlyOwner updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = IERC20(rewardsToken).balanceOf(address(this));
        require(rewardRate <= balance / rewardsDuration, "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(stakingToken), "Cannot withdraw the staking token");
        IERC20(tokenAddress).transfer(ERC2771Context._msgSender(), tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish,
            "Previous rewards period must be complete before changing the duration for the new period"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
}
