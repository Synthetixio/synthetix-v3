// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./interfaces/IBuybackSnx.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

contract BuybackSnx is IBuybackSnx {
    using SafeCastU256 for uint256;
    using DecimalMath for uint256;

    uint256 public premium;
    address public oracleManager;
    bytes32 public snxNodeId;
    address public snxToken;
    address public usdcToken;

    event Buyback(address indexed buyer, uint256 snx, uint256 usdc);

    constructor(uint256 _premium, address _oracleManager, bytes32 _snxNodeId, address _snxToken, address _usdcToken) {
        premium = _premium;
        oracleManager = _oracleManager;
        snxNodeId = _snxNodeId;
        snxToken = _snxToken;
        usdcToken = _usdcToken;
    }

    function buyback(uint256 snxAmount) external {
        NodeOutput.Data memory output = INodeModule(oracleManager).process(snxNodeId);
        uint256 usdcAmount =
            ((uint256(output.price).mulDecimal(snxAmount)).mulDecimal(DecimalMath.UNIT + premium)) / 1e6;

        require(IERC20(snxToken).transferFrom(msg.sender, address(this), snxAmount), "No allowance");
        require(IERC20(usdcToken).transfer(msg.sender, usdcAmount), "Not enough USDC");

        emit Buyback(msg.sender, snxAmount, usdcAmount);
    }

    // Implement FeeCollector interface
    // swap sUSD to sUSDC and unwrap

    function quoteFees(uint128 marketId, uint256 feeAmount, address sender) external override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        marketId;
        sender;

        return (feeAmount) / 1e18;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IFeeCollector).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
