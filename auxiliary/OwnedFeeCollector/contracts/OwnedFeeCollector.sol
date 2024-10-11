//SPDX-License-Identifier: MIT
// solhint-disable meta-transactions/no-msg-sender
pragma solidity >=0.8.11 <0.9.0;

import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {IFeeCollector} from "@synthetixio/perps-market/contracts/interfaces/external/IFeeCollector.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";

/**
 * @title Owned Fee Collector.
 */
contract OwnedFeeCollector is IFeeCollector, Ownable {
    using DecimalMath for uint256;

    address public immutable FEE_TOKEN;
    uint256 public feeShare;
    address public feeShareRecipient;
    address public tempFeeShareRecipient;

    constructor(
        address _owner, // pDAO
        address _feeShareRecipient, // TC
        uint256 _feeShare, // percent of fees for the protocol after integrator fees
        address _feeToken // the fee token that will be sent to this contract. note changing fee token will require a new fee collector
    ) Ownable(_owner) {
        if (_feeShareRecipient == address(0) || _owner == address(0)) {
            revert AddressError.ZeroAddress();
        }
        feeShare = _feeShare;
        FEE_TOKEN = _feeToken;
        feeShareRecipient = _feeShareRecipient;
    }

    function quoteFees(
        uint128 marketId,
        uint256 feeAmount,
        address sender
    ) external view override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        marketId;
        sender;

        return (feeAmount.mulDecimal(feeShare));
    }

    function claimFees() external {
        if (msg.sender != feeShareRecipient && msg.sender != OwnableStorage.load().owner) {
            revert AccessError.Unauthorized(msg.sender);
        }
        uint256 feeTokenBalance = IERC20(FEE_TOKEN).balanceOf(address(this));
        IERC20(FEE_TOKEN).transfer(feeShareRecipient, feeTokenBalance);
    }

    // sets the share of fees for the protocol
    function setFeeShare(uint256 _newFeeShare) external onlyOwner {
        feeShare = _newFeeShare;
    }

    // NOTE there is a 2 step process for setting a new fee share controller
    // the new controller must accept the designation after it is set
    function setFeeShareRecipient(address _newFeeShareRecipient) external onlyOwner {
        tempFeeShareRecipient = _newFeeShareRecipient;
    }

    function acceptFeeShareRecipient() external {
        if (msg.sender != tempFeeShareRecipient) {
            revert AccessError.Unauthorized(msg.sender);
        }
        feeShareRecipient = tempFeeShareRecipient;
        tempFeeShareRecipient = address(0);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IFeeCollector).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
