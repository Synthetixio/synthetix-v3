// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "https://github.com/aave/aave-v3-core/blob/master/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPoolAddressesProvider.sol";
import "https://github.com/aave/aave-v3-core/blob/master/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import "https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/ISwapRouter.sol";
import "https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/IQuoter.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ISynthetixCore} from "@synthetixio/v3-contracts/contracts/interfaces/ISynthetixCore.sol";
import {ISpotMarketProxy} from "@synthetixio/v3-contracts/contracts/interfaces/ISpotMarketProxy.sol";
import {IPerpsMarketProxy} from "@synthetixio/v3-contracts/contracts/interfaces/IPerpsMarketProxy.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "./IPerpsFlashLoanUtil.sol";

/**
 * @title PerpsFlashLoanUtil
 * @notice Implements flash loan utility for closing synthetix perps v3 positions.
 */
contract PerpsFlashLoanUtil is FlashLoanSimpleReceiverBase, IPerpsFlashLoanUtil {
    using SafeCastU256 for uint256;

    ISynthetixCore public synthetixCore;
    ISpotMarketProxy public spotMarketProxy;
    IPerpsMarketProxy public perpsMarketProxy;

    IQuoter public quoter;
    ISwapRouter public router;
    mapping(address => address) public poolAddresses;

    address public USDC;
    address public snxUSD;

    /**
     * @notice Constructor to initialize the contract.
     * @param _addressProvider The address provider for Aave.
     * @param _synthetixCore The address of the Synthetix Core contract.
     * @param _spotMarketProxy The address of the Synthetix Spot Market Proxy contract.
     * @param _perpsMarketProxy The address of the Synthetix Perps Market Proxy contract.
     * @param _quoter The address of the Uniswap Quoter contract.
     * @param _router The address of the Uniswap SwapRouter contract.
     * @param _USDC The address of the USDC token contract.
     * @param _snxUSD The address of the snxUSD token contract.
     */
    constructor(
        address _addressProvider,
        address _synthetixCore,
        address _spotMarketProxy,
        address _perpsMarketProxy,
        address _quoter,
        address _router,
        address _USDC,
        address _snxUSD
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        synthetixCore = ISynthetixCore(_synthetixCore);
        spotMarketProxy = ISpotMarketProxy(_spotMarketProxy);
        perpsMarketProxy = IPerpsMarketProxy(_perpsMarketProxy);
        quoter = IQuoter(_quoter);
        router = ISwapRouter(_router);
        USDC = _USDC;
        snxUSD = _snxUSD;
    }

    /**
     * @inheritdoc IPerpsFlashLoanUtil
     */
    function requestFlashLoan(
        uint256 _amount,
        address _collateralType,
        uint128 _marketId,
        uint128 _accountId
    ) public override {
        address receiverAddress = address(this);
        address asset = USDC;
        uint256 amount = _amount;
        bytes memory params = abi.encode(
            ERC2771Context._msgSender(),
            _collateralType,
            _marketId,
            _accountId
        );
        uint16 referralCode = 0;

        POOL.flashLoanSimple(receiverAddress, asset, amount, params, referralCode);
    }

    /**
     * @inheritdoc IPerpsFlashLoanUtil
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool success) {
        (address sender, address collateralType, uint128 marketId, uint128 accountId) = abi.decode(
            params,
            (address, address, uint128, uint128)
        );

        IERC20(USDC).approve(address(spotMarketProxy), amount);
        spotMarketProxy.wrap(marketId, amount, 0);

        synthetixCore.burnUsd(accountId, synthetixCore.getPreferredPool(), snxUSD, amount);

        perpsMarketProxy.modifyCollateral(accountId, marketId, -amount.toInt256());

        IERC20(collateralType).approve(address(spotMarketProxy), amount);
        (uint256 unwrappedAmount, ) = spotMarketProxy.unwrap(marketId, amount, 0);

        if (collateralType != USDC) {
            IERC20(collateralType).approve(address(router), unwrappedAmount);

            address poolAddress = poolAddresses[collateralType];
            require(poolAddress != address(0), "Pool address not set");

            uint256 amountOutMinimum = quoter.quoteExactInput(
                abi.encodePacked(collateralType, poolAddress, USDC),
                unwrappedAmount
            );

            ISwapRouter.ExactInputParams memory swapParams = ISwapRouter.ExactInputParams({
                path: abi.encodePacked(collateralType, poolAddress, USDC),
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: unwrappedAmount,
                amountOutMinimum: amountOutMinimum
            });
            unwrappedAmount = router.exactInput(swapParams);
        }

        uint256 totalDebt = amount + premium;
        require(unwrappedAmount >= totalDebt, "Not enough USDC to repay loan");
        IERC20(USDC).approve(address(POOL), totalDebt);

        uint256 remainingCollateral = unwrappedAmount - totalDebt;
        IERC20(collateralType).transfer(sender, remainingCollateral);

        return true;
    }

    /**
     * @inheritdoc IPerpsFlashLoanUtil
     */
    function setPoolAddress(address _collateralType, address _poolAddress) external override {
        OwnableStorage.onlyOwner();
        poolAddresses[_collateralType] = _poolAddress;
    }

    receive() external payable {}
}
