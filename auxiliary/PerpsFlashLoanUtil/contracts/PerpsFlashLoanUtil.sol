// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "https://github.com/aave/aave-v3-core/blob/master/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPoolAddressesProvider.sol";
import "https://github.com/aave/aave-v3-core/blob/master/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import "https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/ISwapRouter.sol";
import {ISynthetixCore} from "@synthetixio/v3-contracts/contracts/interfaces/ISynthetixCore.sol";
import {ISpotMarketProxy} from "@synthetixio/v3-contracts/contracts/interfaces/ISpotMarketProxy.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

contract PerpsFlashLoanUtil is FlashLoanSimpleReceiverBase {
    ISynthetixCore public synthetixCore;
    ISpotMarketProxy public spotMarketProxy;
    ISwapRouter public router;
    address public USDC;
    address public snxUSD;
    uint24 public poolFee;

    // TODO: add pool fee mapping to each margin type
    // TODO: maybe use pool address instead of pool fee

    bytes32 internal constant _ADMIN_PERMISSION = "ADMIN";

    constructor(
        address _addressProvider,
        address _synthetixCore,
        address _spotMarketProxy,
        address _router,
        address _USDC,
        address _snxUSD,
        uint24 _poolFee
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        synthetixCore = ISynthetixCore(_synthetixCore);
        spotMarketProxy = ISpotMarketProxy(_spotMarketProxy);
        router = ISwapRouter(_router);
        USDC = _USDC;
        snxUSD = _snxUSD;
        poolFee = _poolFee;
    }

    function requestFlashLoan(
        uint256 _amount,
        address _marginType,
        uint128 _marketId,
        uint128 _accountId
    ) public {
        // Check if this contract has the necessary permissions, if not, grant them
        // TODO: Margin permission
        // if (!perpsmarketproxy.hasPermission(_accountId, _MARGIN_PERMISSION, address(this))) {
        //     perpsmarketproxy.grantPermission(_accountId, _ADMIN_PERMISSION, address(this));
        // }

        // Encode the required params and request the flash loan
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

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Decode the required params
        (address sender, address collateralType, uint128 marketId, uint128 accountId) = abi.decode(
            params,
            (address, address, uint128, uint128)
        );

        // Get the preferred pool ID
        uint128 poolId = synthetixCore.getPreferredPool();

        // Approve and wrap USDC to snxUSD
        IERC20(USDC).approve(address(spotMarketProxy), amount);
        spotMarketProxy.wrap(marketId, amount, 0);

        //TODO: Repay Debt in perps
        synthetixCore.burnUsd(accountId, poolId, snxUSD, amount);

        // Withdraw Margin in perps
        synthetixCore.withdraw(accountId, collateralType, amount);

        // Unwrap collateral to its original form
        IERC20(collateralType).approve(address(spotMarketProxy), amount);
        (uint256 unwrappedAmount, ) = spotMarketProxy.unwrap(marketId, amount, 0);

        // If the unwrapped token is not USDC, swap it to USDC
        if (collateralType != USDC) {
            IERC20(collateralType).approve(address(router), unwrappedAmount);
            ISwapRouter.ExactInputParams memory swapParams = ISwapRouter.ExactInputParams({
                path: abi.encodePacked(collateralType, poolFee, USDC),
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: unwrappedAmount,
                amountOutMinimum: // TODO: calculate minimum amount received - call price view function on Uniswap to get this
                // sell 1M ETH for x$ swapExactTokensForToken
            });
            unwrappedAmount = router.exactInput(swapParams);

            // TODO: set pool
        }

        // Repay flash loan
        uint256 totalDebt = amount + premium;
        require(unwrappedAmount >= totalDebt, "Not enough USDC to repay loan");
        IERC20(USDC).approve(address(POOL), totalDebt);

        // Send remaining collateral to user
        uint256 remainingCollateral = unwrappedAmount - totalDebt;
        IERC20(collateralType).transfer(sender, remainingCollateral);

        // Revoke permission after the operation has completed
        // synthetixCore.revokePermission(accountId, _ADMIN_PERMISSION, address(this));

        return true;
    }

    receive() external payable {}
}
