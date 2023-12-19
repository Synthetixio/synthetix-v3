// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IFeeCollector} from "@synthetixio/perps-market/contracts/interfaces/external/IFeeCollector.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";

contract BuybackSnx is IFeeCollector {
    using SafeCastI256 for int256;
    using DecimalMath for uint256;

    address public immutable DEAD = 0x000000000000000000000000000000000000dEaD;

    uint256 public immutable premium;
    uint256 public immutable snxFeeShare;
    address public immutable oracleManager;
    bytes32 public immutable snxNodeId;
    address public immutable snxToken;
    address public immutable usdToken;

    event BuybackProcessed(address indexed buyer, uint256 snx, uint256 usd);

    constructor(
        uint256 _premium,
        uint256 _snxFeeShare,
        address _oracleManager,
        bytes32 _snxNodeId,
        address _snxToken,
        address _usdToken
    ) {
        premium = _premium;
        snxFeeShare = _snxFeeShare;
        oracleManager = _oracleManager;
        snxNodeId = _snxNodeId;
        snxToken = _snxToken;
        usdToken = _usdToken;
    }

    function processBuyback(uint256 snxAmount) external {
        NodeOutput.Data memory output = INodeModule(oracleManager).process(snxNodeId);
        uint256 usdAmount = (output.price.toUint().mulDecimal(snxAmount)).mulDecimal(
            DecimalMath.UNIT + premium
        );

        IERC20(snxToken).transferFrom(ERC2771Context._msgSender(), DEAD, snxAmount);
        IERC20(usdToken).transfer(ERC2771Context._msgSender(), usdAmount);

        emit BuybackProcessed(ERC2771Context._msgSender(), snxAmount, usdAmount);
    }

    // Implement FeeCollector interface
    function quoteFees(
        uint128 marketId,
        uint256 feeAmount,
        address sender
    ) external view override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        marketId;
        sender;

        return (feeAmount.mulDecimal(snxFeeShare));
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IFeeCollector).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
