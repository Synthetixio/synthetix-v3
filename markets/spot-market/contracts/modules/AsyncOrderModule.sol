// TODO: Natspec
contract AsyncOrderModule is IAsyncOrderModule {
    using AsyncOrder for AsyncOrder.Data;

    event AsyncBuyOrderCommited(
        uint indexed marketId,
        uint indexed asyncOrderId,
        AsyncOrderClaim asyncOrderClaim,
        address indexed sender
    );

    error InsufficientSettlementTimeElapsed(); // TODO: add params
    error InsufficientCancellationTimeElapsed(); // TODO: add params

    function commitBuyOrder(
        uint128 marketId,
        uint amountUsd // TODO: add optional priceData to params. How is this handled during settlement?
    ) external override returns (uint asyncOrderId, AsyncOrder memory asyncOrderClaim) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Accept USD
        uint256 allowance = store.usdToken.allowance(msg.sender, address(this));
        if (store.usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (allowance < amountUsd) {
            revert InsufficientAllowance(amountUsd, allowance);
        }
        store.usdToken.transferFrom(msg.sender, address(this), amountUsd);

        // Apply fees
        (uint256 amountUsable, int256 feesQuoted) = Fee.calculateFees(
            marketId,
            msg.sender,
            amountUsd,
            Fee.TradeType.ASYNC_BUY
        );

        // Get estimated exchange amount
        // TODO: use priceData if available?
        uint256 amountSynth = Price.load(marketId).usdSynthExchangeRate(
            amountUsable,
            Fee.TradeType.ASYNC_BUY
        );

        // Mint synths and hold them in this contract as escrow
        SynthUtil.getToken(marketId).mint(address(this), amountSynth);

        // Issue an async order claim NFT
        asyncOrderId = AsyncOrderClaimUtil.getNft(marketId).mint(msg.sender);

        // Set up order data
        asyncOrderClaim.orderType = Fee.TradeType.ASYNC_BUY;
        asyncOrderClaim.blockNumber = block.number;
        asyncOrderClaim.timestamp = now;
        asyncOrderClaim.amountProvided = amountUsd;
        asyncOrderClaim.amountStaged = amountSynth;
        asyncOrderClaim.feesQuoted = feesQuoted;

        // Store order data
        AsyncOrder.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        emit AsyncBuyOrderCommited(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    function commitSellOrder(
        uint128 marketId,
        uint256 sellAmount // add optional priceData to params
    ) external override returns (uint asyncOrderId, AsyncOrder memory asyncOrderClaim) {
        // TODO: Sort this out after buy, settle, and cancel
    }

    function settleOrder(
        uint128 marketId,
        uint256 asyncOrderId,
        bytes priceData
    ) external override returns (uint amountSettled) {
        AsyncOrder asyncOrderClaim = AsyncOrder.load(marketId).asyncOrders[asyncOrderId];

        // Ensure delay has occured
        if (now < asyncOrderClaim.timestamp + AsyncOrder.load(marketId).minimumOrderAge) {
            revert InsufficientSettlementTimeElapsed();
        }

        // Figure out the actual settlement amount and apply adjustment accordingly.
        if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_BUY) {
            amountSettled = _disburseBuyOrderEscrow(asyncOrderClaim, priceData);
        } else if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_SELL) {
            amountSettled = _disburseSellOrderEscrow(asyncOrderClaim, priceData);
        }

        // Burn NFT
        AsyncOrderClaimUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        // TODO: Add info about adjustment?
        emit AsyncOrderSettled(marketId, asyncOrderId, asyncOrderClaim, amountSettled, msg.sender);
    }

    function _disburseBuyOrderEscrow(
        AsyncOrder memory asyncOrderClaim,
        bytes priceData
    ) private returns (uint finalSynthAmount) {
        // Apply fees (TODO: Recalculate in case amount changed? Using orderer here for fee and not settler)
        (uint256 amountUsable, int256 feesQuoted) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.amountProvided,
            Fee.TradeType.ASYNC_BUY
        );

        // Get final exchange amount
        finalSynthAmount = Price.load(marketId).usdSynthExchangeRate(
            amountUsable,
            Fee.TradeType.ASYNC_BUY,
            priceData // TODO: gotta figure out how this will work
        );

        // Deposit USD
        store.usdToken.approve(address(this), asyncOrderClaim.amountProvided);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.amountProvided
        );

        // Mint additional synths into escrow if necessary
        if (finalSynthAmount > asyncOrderClaim.amountProvided) {
            SynthUtil.getToken(marketId).mint(
                address(this),
                finalSynthAmount - asyncOrderClaim.amountProvided
            );
        }

        // Burn additional synths in escrow if necessary
        if (finalSynthAmount < asyncOrderClaim.amountProvided) {
            SynthUtil.getToken(marketId).burn(
                address(this),
                asyncOrderClaim.amountProvided - finalSynthAmount
            );
        }

        // Transfer final synth amount to orderer
        SynthUtil.getToken(marketId).transferFrom(
            address(this),
            AsyncOrderClaimUtil.getNft(marketId).ownerOf(asyncOrderId),
            finalSynthAmount
        );
    }

    function _disburseSellOrderEscrow(
        AsyncOrder memory asyncOrderClaim,
        uint256 finalUsdAmount
    ) private {
        // Follow pattern in _disburseBuyOrderEscrow
        //TODO: note amountWithdrawable might be insufficient
    }

    function cancelOrder(uint128 marketId, uint256 asyncOrderId) external override {
        AsyncOrder asyncOrderClaim = AsyncOrder.load(marketId).asyncOrders[asyncOrderId];

        // Prevent cancellation if this is invoked by someone other than the orderer and the minimum order time plus the external cancellation buffer time hasn't elapsed
        if (
            AsyncOrderClaimUtil.getNft(marketId).ownerOf(asyncOrderId) != msg.sender &&
            now <
            asyncOrderClaim.timestamp +
                AsyncOrder.load(marketId).minimumOrderAge +
                AsyncOrder.load(marketId).externalCancellationBufferTime
        ) {
            revert InsufficientCancellationTimeElapsed();
        }

        // Return escrowed funds
        if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_BUY) {
            _returnBuyOrderEscrow(asyncOrderClaim);
        } else if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_SELL) {
            _returnSellOrderEscrow(asyncOrderClaim);
        }

        // Burn NFT
        AsyncOrderClaimUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        emit AsyncOrderCancelled(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    function _returnBuyOrderEscrow(AsyncOrder memory asyncOrderClaim) private {
        // Return the USD provided, minus the quoted fees
        store.usdToken.transferFrom(
            address(this),
            AsyncOrderClaimUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.amountProvided - asyncOrderClaim.quotedFees
        );

        // Burn the synths escrowed
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderClaim.amountStaged);

        // Deposit the quoted fees
        store.usdToken.approve(address(this), asyncOrderClaim.quotedFees);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.quotedFees
        );
    }

    function _returnSellOrderEscrow(AsyncOrder memory asyncOrderClaim) private {
        // Return the synths provided, minus the quoted fees
        SynthUtil.getToken(marketId).transferFrom(
            address(this),
            AsyncOrderClaimUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.amountProvided - asyncOrderClaim.quotedFees
        );

        // Deposit the escrowed USD
        store.usdToken.approve(address(this), asyncOrderClaim.amountStaged);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.amountStaged
        );

        // Burn quoted fees of synths
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderClaim.quotedFees);
    }
}
