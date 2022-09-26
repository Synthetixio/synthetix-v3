pragma solidity ^0.8.0;

import "@synthetixio/market-fee-manager/interfaces/IMarketFeeManager.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "../interfaces/ISynth.sol";
import "../interfaces/ISpotMarket.sol";

/* 
    Fixed Fee mechanism for Spot Market
*/
contract FixedFeeManager is IMarketFeeManager {
    using MathUtil for uint256;

    address public owner;
    uint public fixedFee; // in bips
    IERC20 public usdToken;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address feeOwner, address usdTokenAddress) {
        owner = feeOwner;
        usdToken = IERC20(usdTokenAddress);
    }

    function setFixedFee(uint fee) external onlyOwner {
        fixedFee = fee;
    }

    function processFees(
        address transactor,
        uint marketId,
        uint amount,
        address synthAddress
    ) external override returns (uint amountUsable, uint feesCollected) {
        require(usdToken.allowance(msg.sender, address(this)) >= amount, "Not enough allowance");

        // ISynth synth = ISynth(ISpotMarket(msg.sender).getMarket(marketId));
        // uint price = ISpotMarket(msg.sender).getSynthPrice(marketId);
        feesCollected = amount.mulDecimal(fixedFee).divDecimal(10000);

        usdToken.transferFrom(msg.sender, address(this), feesCollected);
        amountUsable = amount - feesCollected;
    }
}
