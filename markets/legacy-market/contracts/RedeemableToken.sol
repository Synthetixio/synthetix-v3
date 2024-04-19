//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;


import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";
import "./interfaces/external/IOracleManager.sol";
import "./interfaces/IRedeemableToken.sol";

contract RedeemableToken is IExternalNode, IRedeemableToken, ERC20, Ownable {
		using SafeCastU256 for uint256;
		IERC20 immutable redeemedToken;
		bytes32 immutable priceOracleNode;

		mapping(address => uint256) public allowance;

		struct RedemptionRecord {
			uint128 shares;
			uint128 redeemableTokens;
		}

		mapping(address => RedemptionRecord) public redemptions;
		RedemptionRecord totalRedemptions;


		constructor(address _redeemedToken, bytes32 _priceOracleNode) Ownable(msg.sender) {
			redeemedToken = IERC20(_redeemedToken);
			priceOracleNode = _priceOracleNode;
		}

    /**
     * @inheritdoc IRedeemableToken
     */
    function addRedemption(
        address redeemer,
				uint256 shareAmount,
				uint256 tokenAmount
    ) external onlyOwner {
			redeemedToken.transferFrom(msg.sender, address(this), tokenAmount);
			_mint(msg.sender, shareAmount);

			redemptions[redeemer].shares = shareAmount.to128();
			redemptions[redeemer].redeemableTokens = tokenAmount.to128();
			totalRedemptions.redeemableTokens += tokenAmount.to128();
			totalRedemptions.shares += shareAmount.to128();
    }

    /**
     * @inheritdoc IRedeemableToken
     */
    function redeem(
				uint256 shareAmount
    ) external onlyOwner {
			_burn(msg.sender, shareAmount);

			uint256 tokenAmount = redemptions[msg.sender].redeemableTokens * shareAmount / redemptions[msg.sender].shares;

			redeemedToken.transfer(msg.sender, tokenAmount);

			redemptions[msg.sender].shares -= shareAmount.to128();
			redemptions[msg.sender].redeemableTokens -= tokenAmount.to128();
    }

    /**
     * @inheritdoc IExternalNode
     */
    function process(
        NodeOutput.Data[] memory,
        bytes memory,
        bytes32[] memory,
        bytes32[] memory
		) external view returns (NodeOutput.Data memory) {
			NodeOutput.Data memory redeemablePrice = IOracleManager(msg.sender).process(priceOracleNode);

			return NodeOutput.Data(
				redeemablePrice.price * int256(uint256(totalRedemptions.redeemableTokens)) / int256(uint256(totalRedemptions.shares)),
				redeemablePrice.timestamp,
				redeemablePrice.__slotAvailableForFutureUse1, 
				redeemablePrice.__slotAvailableForFutureUse2
			);
		}

    /**
     * @inheritdoc IExternalNode
     */
		function isValid(NodeDefinition.Data memory) external pure returns (bool) {
			return true;
		}

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IRedeemableToken).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
