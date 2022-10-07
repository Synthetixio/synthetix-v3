pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "../interfaces/ISpotMarketFee.sol";
import "../interfaces/ISpotMarket.sol";

/* 
    Fixed Fee mechanism for Spot Market
*/
contract FixedFee is ISpotMarketFee {
    using MathUtil for uint256;

    address public owner;
    IERC20 public usdToken;
    uint public fixedFee; // in bips
    address public synthetix;

    constructor(
        address feeOwner,
        address usdTokenAddress,
        address synthetixAddress,
        uint fixedFeeAmount
    ) {
        owner = feeOwner;
        usdToken = IERC20(usdTokenAddress);
        fixedFee = fixedFeeAmount;
        synthetix = synthetixAddress;
    }

    function processFees(
        address transactor,
        uint marketId,
        uint amount,
        TradeType tradeType
    ) external override returns (uint amountUsable, uint feesCollected) {
        require(usdToken.allowance(msg.sender, address(this)) >= amount, "Not enough allowance");

        (amountUsable, feesCollected) = _calculateFees(transactor, marketId, amount, tradeType);
        usdToken.transferFrom(msg.sender, address(this), feesCollected);
    }

    function getFeesQuote(
        address transactor,
        uint marketId,
        uint amount,
        TradeType tradeType
    ) external view override returns (uint amountUsable, uint feesCollected) {
        return _calculateFees(transactor, marketId, amount, tradeType);
    }

    function _calculateFees(
        address transactor,
        uint marketId,
        uint amount,
        TradeType tradeType
    ) internal view returns (uint amountUsable, uint feesCollected) {
        feesCollected = amount.mulDecimal(fixedFee).divDecimal(10000);
        amountUsable = amount - feesCollected;
    }
}
