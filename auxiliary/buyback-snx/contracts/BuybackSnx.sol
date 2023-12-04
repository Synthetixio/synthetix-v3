// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./interfaces/IBuybackSnx.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

contract BuybackSnx is IBuybackSnx {
    using SafeCastU256 for uint256;
    using DecimalMath for uint256;

    uint256 public premium;
    uint256 public snxFeeShare;
    address public oracleManager;
    bytes32 public snxNodeId;
    address public snxToken;
    address public susdToken;

    event Buyback(address indexed buyer, uint256 snx, uint256 susd);

    constructor(
        uint256 _premium,
        uint256 _snxFeeShare,
        address _oracleManager,
        bytes32 _snxNodeId,
        address _snxToken,
        address _susdToken
    ) {
        premium = _premium;
        snxFeeShare = _snxFeeShare;
        oracleManager = _oracleManager;
        snxNodeId = _snxNodeId;
        snxToken = _snxToken;
        susdToken = _susdToken;
    }

    function buyback(uint256 snxAmount) external {
        NodeOutput.Data memory output = INodeModule(oracleManager).process(snxNodeId);
        uint256 susdAmount = (uint256(output.price).mulDecimal(snxAmount)).mulDecimal(DecimalMath.UNIT + premium);

        require(IERC20(snxToken).transferFrom(ERC2771Context._msgSender(), address(this), snxAmount), "No allowance");
        require(IERC20(susdToken).transfer(ERC2771Context._msgSender(), susdAmount), "Not enough sUSD");

        emit Buyback(ERC2771Context._msgSender(), snxAmount, susdAmount);
    }

    // Implement FeeCollector interface
    function quoteFees(uint128 marketId, uint256 feeAmount, address sender) external override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        marketId;
        sender;

        return (feeAmount * snxFeeShare) / 1e18;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IFeeCollector).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
