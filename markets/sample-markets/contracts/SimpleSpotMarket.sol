//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

contract SimpleSpotMarket is IMarket {
    using DecimalMath for uint256;

    address public snxSystem;
    address public marketToInsure;

    uint public feeRate;

    uint portionCovered;

    mapping(address => uint) coverages;

    constructor(address snxSystem, uint128 marketToInsure) UUPSProxy(firstImplementation) {
        this.snxSystem = snxSystem;
        this.marketToInsure = marketToInsure;
    }

    function balance() {
        if (_isInsolvent()) {
            return marketToinsure.totalSupply().mulDecimal(portionCovered);
        } else {
            return 0;
        }
    }

    function locked() {
        return marketToInsure.totalSupply().mulDecimal(portionCovered);
    }

    function setFeeRate(uint amount) external onlyOwner {
        this.feeRate = feeRate;
    }

    function purchase(address beneficiary, uint period) {
        uint amountToInsure = marketToInsure.balanceOf(beneficiary).divDecimal(marketToInsure.totalSupply());

        uint fee = marketToInsure.balanceOf(beneficiary).mulDecimal(feeRate);

        snxSystem.deposit(msg.sender, fee);

        totalCoverage += amountToInsure;
        coverages[beneficiary] = amountToInsure;
    }

    function claim(address) {}

    function _isInsolvent() {
        return snxSystem.totalAvailableLiquidity(marketToInsure) < this.marketToInsure.balance(marketToInsure);
    }
}
