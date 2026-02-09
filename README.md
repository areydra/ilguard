# ILGuard - Impermanent Loss Protection Agent

**Protecting 51% of unprofitable LPs from losing money.**

## The Problem

Research shows that **51% of Uniswap v3 liquidity providers are UNPROFITABLE** because impermanent loss exceeds their fee income. On Solana DeFi alone ($11.5B TVL), thousands of LPs are bleeding money every day from IL.

Current tools only show IL AFTER it happens. By then, it's too late.

## The Solution

**ILGuard** is an AI agent that monitors your liquidity provider positions 24/7, **predicts** impermanent loss 15-30 minutes before it materializes, and automatically rebalances to protect your capital while maximizing fee earnings.

## Key Features

### 🔮 Predictive IL Algorithm
- ML model predicts IL based on price velocity & volatility
- 15-30 minute advance warning before IL materializes
- Prevents losses, not just measures them

### 🛡️ Smart Auto-Rebalancing
- Widens ranges when volatility spikes
- Narrows ranges when market stabilizes
- Only acts when savings > 10x gas costs

### ⚡ MEV Protection
- Uses Jito bundles for atomic operations
- Prevents sandwich attacks on rebalances
- Priority fees managed automatically

### 📊 Multi-Protocol Support
- Orca CLMM (Concentrated Liquidity)
- Meteora DLMM (Dynamic Liquidity)
- Raydium (coming soon)

### 💰 Performance-Based Pricing
- Only pay when we save you money
- 10% of IL prevented
- First $100 saved is FREE

## Quick Start

### Prerequisites
- Node.js 18+
- Solana wallet with devnet SOL
- Helius API key (free tier works)

### Installation

\`\`\`bash
git clone https://github.com/yourusername/ilguard
cd ilguard
npm install
\`\`\`

### Configuration

\`\`\`bash
cp .env.example .env
# Edit .env with your keys
\`\`\`

### Run Tests

\`\`\`bash
# Test IL calculator
npm run test:il

# Test full system (coming soon)
npm run dev
\`\`\`

## How It Works

1. **Monitor**: Tracks your LP positions across Orca/Meteora in real-time
2. **Predict**: ML model analyzes price velocity → predicts IL 15-30 min ahead
3. **Decide**: Risk engine calculates if rebalancing saves more than it costs
4. **Execute**: Auto-rebalances via Jito bundles (MEV-protected)
5. **Report**: Dashboard shows IL prevented + total savings

## Example: Real Savings

**Scenario**: You provide $10K SOL-USDC liquidity at a narrow range

- **Without ILGuard**: SOL pumps 15% overnight → -$450 IL, +$120 fees = **-$330 loss**
- **With ILGuard**: Agent detects volatility spike → widens range → -$180 IL, +$85 fees = **-$95 loss**

**Savings**: $235 (70% reduction in losses)
**ILGuard Fee**: $23.50 (10% of savings)
**Your Net Gain**: $211.50

## Technical Stack

- **Backend**: Node.js + TypeScript
- **Blockchain**: Solana Web3.js, Anchor
- **DEX Integration**: Orca SDK, Meteora SDK
- **Price Feeds**: Pyth Network
- **MEV Protection**: Jito Bundles
- **ML/Prediction**: TensorFlow.js (statistical model for MVP)

## Architecture

See [ILGuard-architecture.md](../ILGuard-architecture.md) for detailed technical design.

## Development Status

**Current Phase**: MVP Development (3-day hackathon sprint)

✅ **Completed**:
- IL calculator implementation
- Project structure & config
- Architecture design

🚧 **In Progress**:
- IL prediction engine
- Position monitoring service

⏳ **Coming Next**:
- Auto-rebalancing engine
- Dashboard UI
- AgentWallet integration

## Contributing

This project is being built for the Colosseum Agent Hackathon. After the hackathon, contributions will be welcome!

## License

MIT

## Links

- **Hackathon Project**: [Coming soon]
- **Demo Video**: [Coming soon]
- **Forum Post**: [Coming soon]

---

**Built with ❤️ for the 51% of LPs who deserve better tools**
