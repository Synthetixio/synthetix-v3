// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import "./interfaces/IBuybackSnx.sol";

contract BuybackSnx is IBuybackSnx {
    using SafeCastU256 for uint256;

    address public admin;
    address public treasury;
    uint256 public premium;

    address public constant SNX = 0x22e6966B799c4D5B13BE962E1D117b56327FDa66;
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant STALENESS_NODE = 0x22e6966B799c4D5B13BE962E1D117b56327FDa66;

    event Buyback(address indexed buyer, uint256 snx, uint256 usdc);
    event UpdateAdmin(address indexed newAdmin);
    event UpdateTreasury(address indexed newTreasury);
    event UpdatePremium(uint256 indexed newPremium);

    constructor() {
        admin = msg.sender;
        treasury = msg.sender;
        emit UpdateAdmin(msg.sender);
        emit UpdateTreasury(msg.sender);
    }

    function buySnx(uint256 snxAmount) external {
        NodeOutput.Data memory output = INodeModule(STALENESS_NODE).process(bytes32("0xdeadbeef"));
        // solhint-disable-next-line numcast/safe-cast
        uint256 usdcAmount = ((uint256(output.price) * snxAmount) * (1 + premium)) / 1e6;

        require(IERC20(SNX).transferFrom(msg.sender, treasury, snxAmount), "No allowance");
        require(IERC20(USDC).transfer(msg.sender, usdcAmount), "Not enough USDC");

        emit Buyback(msg.sender, snxAmount, usdcAmount);
    }

    function price() external view returns (int256) {
        NodeOutput.Data memory output = INodeModule(STALENESS_NODE).process(bytes32("0xdeadbeef"));
        return output.price;
    }

    function totalUsdc() external view returns (uint256) {
        return IERC20(USDC).balanceOf(address(this));
    }

    function maxAmount() external view returns (uint256) {
        NodeOutput.Data memory output = INodeModule(STALENESS_NODE).process(bytes32("0xdeadbeef"));
        uint256 amount = IERC20(USDC).balanceOf(address(this));
        // solhint-disable-next-line numcast/safe-cast
        return ((amount / uint256(output.price)) * (1 + premium)) * 1e18;
    }

    function sweep(address token, uint256 amount) external {
        require(msg.sender == admin, "Only admin");
        uint256 value = amount;
        if (value == type(uint256).max) {
            value = IERC20(token).balanceOf(address(this));
        }
        require(IERC20(token).transfer(admin, value), "Transfer failed");
    }

    function setAdmin(address proposedAdmin) external {
        require(msg.sender == admin, "Only admin");
        admin = proposedAdmin;
        emit UpdateAdmin(proposedAdmin);
    }

    function setTreasury(address newTreasury) external {
        require(msg.sender == admin, "Only admin");
        treasury = newTreasury;
        emit UpdateTreasury(newTreasury);
    }

    function setPremium(uint256 newPremium) external {
        require(msg.sender == admin, "Only admin");
        require(newPremium > 0 && newPremium < 1, "Must be between 0 and 1");
        premium = newPremium;
        emit UpdatePremium(newPremium);
    }
}
