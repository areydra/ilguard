/**
 * Position Monitor Service
 *
 * Monitors liquidity provider positions across Orca CLMM pools
 * Tracks position metadata, current IL, and fee earnings
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { calculateImpermanentLoss } from '../utils/ilCalculator';
import PriceService from './priceService';
import config from '../config';

export interface LPPosition {
  // Position identification
  positionMint: string;
  whirlpoolAddress: string;
  protocol: 'orca' | 'meteora' | 'raydium';

  // Token info
  tokenA: {
    symbol: string;
    mint: string;
    amount: number;
    valueUSD: number;
  };
  tokenB: {
    symbol: string;
    mint: string;
    amount: number;
    valueUSD: number;
  };

  // Position metrics
  totalValueUSD: number;
  entryValueUSD: number;
  currentIL: number; // Percentage
  currentILValue: number; // USD
  feesEarnedUSD: number;
  netPnL: number; // fees - IL

  // Range info
  priceLower: number;
  priceUpper: number;
  currentPrice: number;
  inRange: boolean;

  // Metadata
  entryTimestamp: number;
  lastUpdated: number;
  liquidity: string;
}

export interface PositionUpdate {
  position: LPPosition;
  ilChange: number; // % change since last check
  recommendation: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export class PositionMonitor {
  private connection: Connection;
  private priceService: PriceService;
  private positions: Map<string, LPPosition> = new Map();
  private updateCallbacks: Map<string, (update: PositionUpdate) => void> = new Map();

  // Token symbol mapping (extend as needed)
  private readonly TOKEN_SYMBOLS: Record<string, string> = {
    'So11111111111111111111111111111111111111112': 'SOL',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  };

  constructor(priceService: PriceService) {
    this.connection = new Connection(config.solana.rpcUrl);
    this.priceService = priceService;
  }

  /**
   * Fetch all LP positions for a wallet
   *
   * Note: In production, this would integrate with Orca SDK to fetch real positions
   * For MVP, we use mock positions for testing and demonstration
   */
  async fetchPositions(walletAddress: string): Promise<LPPosition[]> {
    try {
      // In production, this would:
      // 1. Query Orca Whirlpool program accounts for positions owned by wallet
      // 2. Fetch whirlpool data for each position
      // 3. Calculate token amounts and values from on-chain data
      //
      // For MVP demo, return any existing mock positions

      const positions = Array.from(this.positions.values());
      console.log(`✅ Found ${positions.length} position(s) for wallet ${walletAddress}`);

      return positions;
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }

  /**
   * Update a position with current market data
   */
  async updatePosition(positionMint: string): Promise<LPPosition | null> {
    const position = this.positions.get(positionMint);
    if (!position) {
      console.error(`Position ${positionMint} not found`);
      return null;
    }

    try {
      // Get current prices for both tokens
      const priceA = await this.priceService.getPrice(`${position.tokenA.symbol}/USD`);
      const priceB = await this.priceService.getPrice(`${position.tokenB.symbol}/USD`);

      if (!priceA || !priceB) {
        console.error('Failed to fetch prices for position tokens');
        return null;
      }

      // Update token values
      position.tokenA.valueUSD = position.tokenA.amount * priceA.price;
      position.tokenB.valueUSD = position.tokenB.amount * priceB.price;
      position.totalValueUSD = position.tokenA.valueUSD + position.tokenB.valueUSD;

      // Calculate current IL
      // For CLMM, IL is calculated based on price movement from entry
      const currentPrice = priceA.price / priceB.price;
      const ilResult = calculateImpermanentLoss(
        position.currentPrice, // entry price
        currentPrice,
        position.entryValueUSD
      );

      position.currentIL = ilResult.ilPercentage;
      position.currentILValue = ilResult.ilValue;
      position.currentPrice = currentPrice;

      // Calculate net P&L
      position.netPnL = position.feesEarnedUSD - Math.abs(position.currentILValue);

      // Check if in range
      position.inRange = currentPrice >= position.priceLower && currentPrice <= position.priceUpper;

      position.lastUpdated = Date.now();

      // Trigger callback if registered
      const callback = this.updateCallbacks.get(positionMint);
      if (callback) {
        const update = this.createPositionUpdate(position);
        callback(update);
      }

      return position;
    } catch (error) {
      console.error(`Error updating position ${positionMint}:`, error);
      return null;
    }
  }

  /**
   * Update all positions
   */
  async updateAllPositions(): Promise<Map<string, LPPosition>> {
    const updates = new Map<string, LPPosition>();

    for (const [positionMint, position] of this.positions) {
      const updated = await this.updatePosition(positionMint);
      if (updated) {
        updates.set(positionMint, updated);
      }
    }

    return updates;
  }

  /**
   * Monitor a position continuously
   */
  monitorPosition(
    positionMint: string,
    onUpdate: (update: PositionUpdate) => void,
    intervalSeconds: number = 30
  ): NodeJS.Timeout {
    // Register callback
    this.updateCallbacks.set(positionMint, onUpdate);

    // Start monitoring
    return setInterval(async () => {
      await this.updatePosition(positionMint);
    }, intervalSeconds * 1000);
  }

  /**
   * Create position update with recommendations
   */
  private createPositionUpdate(position: LPPosition): PositionUpdate {
    const ilChange = 0; // TODO: Track IL changes over time

    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let recommendation = '';

    const absIL = Math.abs(position.currentIL);

    if (!position.inRange) {
      urgency = 'critical';
      recommendation = `Position OUT OF RANGE! Current price: $${position.currentPrice.toFixed(2)}, Range: $${position.priceLower.toFixed(2)}-$${position.priceUpper.toFixed(2)}. Rebalance immediately to resume earning fees.`;
    } else if (absIL > 6) {
      urgency = 'critical';
      recommendation = `CRITICAL IL: ${absIL.toFixed(2)}% (${position.currentILValue.toFixed(2)} USD). Consider exiting or widening range.`;
    } else if (absIL > 4) {
      urgency = 'high';
      recommendation = `High IL: ${absIL.toFixed(2)}% (${position.currentILValue.toFixed(2)} USD). Monitor closely, consider widening range.`;
    } else if (absIL > 2) {
      urgency = 'medium';
      recommendation = `Moderate IL: ${absIL.toFixed(2)}% (${position.currentILValue.toFixed(2)} USD). Position stable but watch for volatility.`;
    } else {
      urgency = 'low';
      recommendation = `Low IL: ${absIL.toFixed(2)}% (${position.currentILValue.toFixed(2)} USD). Position healthy. Net P&L: $${position.netPnL.toFixed(2)}.`;
    }

    return {
      position,
      ilChange,
      recommendation,
      urgency,
    };
  }

  /**
   * Get position summary
   */
  getPositionSummary(positionMint: string): string {
    const position = this.positions.get(positionMint);
    if (!position) return 'Position not found';

    const inRangeText = position.inRange ? '✅ IN RANGE' : '❌ OUT OF RANGE';
    const ilText = position.currentIL < 0
      ? `${Math.abs(position.currentIL).toFixed(2)}% loss`
      : `${position.currentIL.toFixed(2)}% gain`;

    return `
${position.tokenA.symbol}-${position.tokenB.symbol} Position ${inRangeText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Value: $${position.totalValueUSD.toFixed(2)}
IL: ${ilText} ($${position.currentILValue.toFixed(2)})
Fees Earned: $${position.feesEarnedUSD.toFixed(2)}
Net P&L: $${position.netPnL.toFixed(2)}

Range: $${position.priceLower.toFixed(2)} - $${position.priceUpper.toFixed(2)}
Current: $${position.currentPrice.toFixed(2)}
`;
  }

  /**
   * Get all positions
   */
  getAllPositions(): LPPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get positions by risk level
   */
  getPositionsByRisk(): {
    low: LPPosition[];
    medium: LPPosition[];
    high: LPPosition[];
    critical: LPPosition[];
  } {
    const result: {
      low: LPPosition[];
      medium: LPPosition[];
      high: LPPosition[];
      critical: LPPosition[];
    } = { low: [], medium: [], high: [], critical: [] };

    for (const position of this.positions.values()) {
      const absIL = Math.abs(position.currentIL);

      if (!position.inRange || absIL > 6) {
        result.critical.push(position);
      } else if (absIL > 4) {
        result.high.push(position);
      } else if (absIL > 2) {
        result.medium.push(position);
      } else {
        result.low.push(position);
      }
    }

    return result;
  }

  /**
   * Create a mock position for testing
   */
  createMockPosition(
    tokenASymbol: string,
    tokenBSymbol: string,
    entryPrice: number,
    priceLower: number,
    priceUpper: number,
    valueUSD: number = 10000
  ): LPPosition {
    const positionMint = `mock-${Date.now()}`;

    const mockPosition: LPPosition = {
      positionMint,
      whirlpoolAddress: 'mock-whirlpool',
      protocol: 'orca',
      tokenA: {
        symbol: tokenASymbol,
        mint: 'mock-mint-a',
        amount: valueUSD / 2 / entryPrice,
        valueUSD: valueUSD / 2,
      },
      tokenB: {
        symbol: tokenBSymbol,
        mint: 'mock-mint-b',
        amount: valueUSD / 2,
        valueUSD: valueUSD / 2,
      },
      totalValueUSD: valueUSD,
      entryValueUSD: valueUSD,
      currentIL: 0,
      currentILValue: 0,
      feesEarnedUSD: 0,
      netPnL: 0,
      priceLower,
      priceUpper,
      currentPrice: entryPrice,
      inRange: true,
      entryTimestamp: Date.now(),
      lastUpdated: Date.now(),
      liquidity: '1000000',
    };

    this.positions.set(positionMint, mockPosition);
    return mockPosition;
  }
}

/**
 * Example usage and tests
 */
async function testPositionMonitor() {
  console.log('\n=== Testing Position Monitor ===\n');

  const priceService = new PriceService();
  const monitor = new PositionMonitor(priceService);

  // Test 1: Create mock position
  console.log('Test 1: Creating mock SOL-USDC position...');
  const mockPosition = monitor.createMockPosition(
    'SOL',
    'USDC',
    100, // Entry price: $100
    90,  // Lower bound: $90
    110, // Upper bound: $110
    10000 // $10k position
  );

  console.log('✅ Mock position created:');
  console.log(`   Position ID: ${mockPosition.positionMint}`);
  console.log(`   Pair: ${mockPosition.tokenA.symbol}-${mockPosition.tokenB.symbol}`);
  console.log(`   Entry Price: $${mockPosition.currentPrice}`);
  console.log(`   Range: $${mockPosition.priceLower} - $${mockPosition.priceUpper}`);
  console.log(`   Value: $${mockPosition.totalValueUSD.toFixed(2)}`);

  // Test 2: Collect price history
  console.log('\nTest 2: Collecting price data...');
  for (let i = 0; i < 3; i++) {
    await priceService.getPrice('SOL/USD');
    await priceService.getPrice('USDC/USD');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test 3: Update position with current market data
  console.log('\nTest 3: Updating position with current market data...');
  const updated = await monitor.updatePosition(mockPosition.positionMint);

  if (updated) {
    console.log('✅ Position updated:');
    console.log(`   Current Price: $${updated.currentPrice.toFixed(2)}`);
    console.log(`   Current Value: $${updated.totalValueUSD.toFixed(2)}`);
    console.log(`   IL: ${updated.currentIL.toFixed(2)}% ($${updated.currentILValue.toFixed(2)})`);
    console.log(`   In Range: ${updated.inRange ? 'YES' : 'NO'}`);
    console.log(`   Net P&L: $${updated.netPnL.toFixed(2)}`);
  }

  // Test 4: Get position summary
  console.log('\nTest 4: Position Summary:');
  console.log(monitor.getPositionSummary(mockPosition.positionMint));

  // Test 5: Monitor position
  console.log('Test 5: Monitoring position for 20 seconds...');
  let updateCount = 0;

  const interval = monitor.monitorPosition(
    mockPosition.positionMint,
    (update) => {
      updateCount++;
      console.log(`\n   📊 Update #${updateCount}:`);
      console.log(`      IL: ${update.position.currentIL.toFixed(2)}%`);
      console.log(`      Urgency: ${update.urgency.toUpperCase()}`);
      console.log(`      ${update.recommendation}`);
    },
    10 // Check every 10 seconds
  );

  setTimeout(() => {
    clearInterval(interval);
    console.log(`\n✅ Monitoring complete. Total updates: ${updateCount}`);
    process.exit(0);
  }, 20000);
}

// Run tests if called directly
if (require.main === module) {
  testPositionMonitor().catch(console.error);
}

export default PositionMonitor;
