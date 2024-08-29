//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {IFeeCollector} from "@synthetixio/perps-market/contracts/interfaces/external/IFeeCollector.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Owned Fee Collector.
 */
contract OwnedFeeCollector is IFeeCollector, Ownable {
    using DecimalMath for uint256;

    uint256 public immutable ownerFeeShare;
    address public immutable feeToken;

    constructor(address _owner, uint256 _ownerFeeShare, address _feeToken) Ownable(_owner) {
        ownerFeeShare = _ownerFeeShare;
        feeToken = _feeToken;
    }

    function quoteFees(
        uint128 marketId,
        uint256 feeAmount,
        address sender
    ) external override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        marketId;
        sender;

        return (feeAmount.mulDecimal(ownerFeeShare));
    }

    function claimFees() external onlyOwner {
        address owner = owner();
        uint256 feeTokenBalance = IERC20(feeToken).balanceOf(address(this));
        IERC20(feeToken).transfer(owner, feeTokenBalance);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IFeeCollector).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
