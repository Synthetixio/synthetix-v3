// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./interfaces/IBuybackSnx.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {OracleManager} from "@synthetixio/main/contracts/storage/OracleManager.sol";
import {Ownable} from "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

contract BuybackSnx is IBuybackSnx, Ownable {
    using SafeCastU256 for uint256;
    using DecimalMath for uint256;

    address public treasury;
    uint256 public premium;
    bytes32 public snxNodeId;
    address public snxToken;
    address public usdcToken;

    event Buyback(address indexed buyer, uint256 snx, uint256 usdc);
    event UpdateTreasury(address indexed newTreasury);
    event UpdatePremium(uint256 indexed newPremium);
    event UpdateNodeId(bytes32 indexed newNodeId);
    event UpdateSnxToken(address indexed newSnxToken);
    event UpdateUsdcToken(address indexed newUsdcToken);

    constructor(address initialOwner) Ownable(initialOwner) {
        treasury = initialOwner;
        premium = 1 ether / 100; // default 1% premium
    }

    function buySnx(uint256 snxAmount) external {
        NodeOutput.Data memory output = INodeModule(OracleManager.load().oracleManagerAddress).process(snxNodeId);
        uint256 usdAmount = ((uint256(output.price).mulDecimal(snxAmount)).mulDecimal(DecimalMath.UNIT + premium)) / 1e6;

        require(IERC20(snxToken).transferFrom(msg.sender, treasury, snxAmount), "No allowance");
        require(IERC20(usdcToken).transfer(msg.sender, usdAmount), "Not enough USDC");

        emit Buyback(msg.sender, snxAmount, usdAmount);
    }

    function sweep(address token, uint256 amount) external onlyOwner {
        uint256 value = amount;
        if (value == type(uint256).max) {
            value = IERC20(token).balanceOf(address(this));
        }
        require(IERC20(token).transfer(treasury, value), "Transfer failed");
    }

    function setTreasury(address newTreasury) external onlyOwner {
        treasury = newTreasury;
        emit UpdateTreasury(newTreasury);
    }

    function setPremium(uint256 newPremium) external onlyOwner {
        require(newPremium > 0 && newPremium < DecimalMath.UNIT, "Invalid premium value");
        premium = newPremium;
        emit UpdatePremium(newPremium);
    }

    function setNodeId(bytes32 newNodeId) external onlyOwner {
        snxNodeId = newNodeId;
        emit UpdateNodeId(newNodeId);
    }

    function setSnxToken(address newSnxToken) external onlyOwner {
        snxToken = newSnxToken;
        emit UpdateSnxToken(newSnxToken);
    }

    function setUsdcToken(address newUsdcToken) external onlyOwner {
        usdcToken = newUsdcToken;
        emit UpdateUsdcToken(newUsdcToken);
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
