// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IFeeCollector} from "@synthetixio/perps-market/contracts/interfaces/external/IFeeCollector.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {Buyback} from "./storage/Buyback.sol";

contract BuybackSnx is IFeeCollector {
    using SafeCastU256 for uint256;
    using DecimalMath for uint256;

    event BuybackProcessed(address indexed buyer, uint256 snx, uint256 usd);

    constructor(
        uint256 _premium,
        uint256 _snxFeeShare,
        address _oracleManager,
        bytes32 _snxNodeId,
        address _snxToken,
        address _usdToken
    ) {
        Buyback.Data storage b = Buyback.load();
        b.premium = _premium;
        b.snxFeeShare = _snxFeeShare;
        b.oracleManager = _oracleManager;
        b.snxNodeId = _snxNodeId;
        b.snxToken = _snxToken;
        b.usdToken = _usdToken;
    }

    function processBuyback(uint256 snxAmount) external {
        Buyback.Data storage b = Buyback.load();

        NodeOutput.Data memory output = INodeModule(b.oracleManager).process(b.snxNodeId);
        uint256 usdAmount = (uint256(output.price).mulDecimal(snxAmount)).mulDecimal(DecimalMath.UNIT + b.premium);

        require(IERC20(b.snxToken).transferFrom(ERC2771Context._msgSender(), address(this), snxAmount), "No allowance");
        require(IERC20(b.usdToken).transfer(ERC2771Context._msgSender(), usdAmount), "Not enough usd");

        emit BuybackProcessed(ERC2771Context._msgSender(), snxAmount, usdAmount);
    }

    function getSnxFeeShare() public view returns (uint256) {
        return Buyback.load().snxFeeShare;
    }

    function getSnxNodeId() public view returns (bytes32) {
        return Buyback.load().snxNodeId;
    }

    function getPremium() public view returns (uint256) {
        return Buyback.load().premium;
    }

    // Implement FeeCollector interface
    function quoteFees(uint128 marketId, uint256 feeAmount, address sender) external view override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        marketId;
        sender;

        return (feeAmount * Buyback.load().snxFeeShare) / 1e18;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IFeeCollector).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
