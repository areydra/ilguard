/**
 * Price Service
 *
 * Fetches real-time price data from Pyth Network
 * Tracks price velocity and volatility for IL prediction
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { HermesClient } from '@pythnetwork/hermes-client';
import config from '../config';

// Pyth price feed IDs for common tokens
export const PRICE_FEED_IDS = {
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'JUP/USD': '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
};

export interface PriceData {
  symbol: string;
  price: number;
  confidence: number;
  timestamp: number;
  expo: number;
}

export interface PriceVelocity {
  symbol: string;
  currentPrice: number;
  priceChange1min: number;
  priceChange5min: number;
  priceChange15min: number;
  velocityPerHour: number; // Estimated % change per hour
}

export class PriceService {
  private connection: Connection;
  private hermesClient: HermesClient;
  private priceHistory: Map<string, Array<{ price: number; timestamp: number }>> = new Map();
  private readonly MAX_HISTORY_POINTS = 100;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl);
    this.hermesClient = new HermesClient(config.pyth.endpoint);
  }

  /**
   * Get current price for a token pair
   */
  async getPrice(symbol: string): Promise<PriceData | null> {
    const feedId = PRICE_FEED_IDS[symbol as keyof typeof PRICE_FEED_IDS];
    if (!feedId) {
      console.error(`Unknown price feed symbol: ${symbol}`);
      return null;
    }

    try {
      const priceUpdates = await this.hermesClient.getLatestPriceUpdates([feedId]);

      if (!priceUpdates || !priceUpdates.parsed || priceUpdates.parsed.length === 0) {
        return null;
      }

      const priceFeed = priceUpdates.parsed[0];
      if (!priceFeed || !priceFeed.price) return null;

      const price = Number(priceFeed.price.price) * Math.pow(10, priceFeed.price.expo);
      const confidence = Number(priceFeed.price.conf) * Math.pow(10, priceFeed.price.expo);

      const result: PriceData = {
        symbol,
        price,
        confidence,
        timestamp: Date.now(),
        expo: priceFeed.price.expo,
      };

      // Store in history
      this.addToHistory(symbol, price);

      return result;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get prices for multiple tokens at once
   */
  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();

    const feedIds = symbols
      .map(s => PRICE_FEED_IDS[s as keyof typeof PRICE_FEED_IDS])
      .filter(id => id !== undefined);

    try {
      const priceUpdates = await this.hermesClient.getLatestPriceUpdates(feedIds);

      if (priceUpdates && priceUpdates.parsed) {
        for (let i = 0; i < priceUpdates.parsed.length; i++) {
          const priceFeed = priceUpdates.parsed[i];
          const symbol = symbols[i];
          if (!priceFeed || !symbol || !priceFeed.price) continue;

          const price = Number(priceFeed.price.price) * Math.pow(10, priceFeed.price.expo);
          const confidence = Number(priceFeed.price.conf) * Math.pow(10, priceFeed.price.expo);

          prices.set(symbol, {
            symbol,
            price,
            confidence,
            timestamp: Date.now(),
            expo: priceFeed.price.expo,
          });

          this.addToHistory(symbol, price);
        }
      }
    } catch (error) {
      console.error('Error fetching multiple prices:', error);
    }

    return prices;
  }

  /**
   * Calculate price velocity (rate of change)
   * Used for IL prediction
   */
  getPriceVelocity(symbol: string): PriceVelocity | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 2) {
      return null;
    }

    const now = Date.now();
    const currentPrice = history[history.length - 1]?.price || 0;

    // Find prices at different time intervals
    const price1minAgo = this.findPriceAtTime(history, now - 60 * 1000);
    const price5minAgo = this.findPriceAtTime(history, now - 5 * 60 * 1000);
    const price15minAgo = this.findPriceAtTime(history, now - 15 * 60 * 1000);

    // Calculate % changes
    const priceChange1min = price1minAgo ? ((currentPrice - price1minAgo) / price1minAgo) * 100 : 0;
    const priceChange5min = price5minAgo ? ((currentPrice - price5minAgo) / price5minAgo) * 100 : 0;
    const priceChange15min = price15minAgo ? ((currentPrice - price15minAgo) / price15minAgo) * 100 : 0;

    // Estimate hourly velocity based on recent trends
    // Use weighted average: 15min (50%), 5min (30%), 1min (20%)
    const velocityPerHour = (
      priceChange15min * 0.5 * 4 + // 15min * 4 = 1 hour
      priceChange5min * 0.3 * 12 +  // 5min * 12 = 1 hour
      priceChange1min * 0.2 * 60    // 1min * 60 = 1 hour
    );

    return {
      symbol,
      currentPrice,
      priceChange1min,
      priceChange5min,
      priceChange15min,
      velocityPerHour,
    };
  }

  /**
   * Calculate volatility (standard deviation of price changes)
   */
  getVolatility(symbol: string, windowMinutes: number = 15): number {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 3) {
      return 0;
    }

    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    const recentPrices = history
      .filter(p => now - p.timestamp < windowMs)
      .map(p => p.price);

    if (recentPrices.length < 3) {
      return 0;
    }

    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < recentPrices.length; i++) {
      const prev = recentPrices[i - 1];
      const curr = recentPrices[i];
      if (prev && curr) {
        changes.push(((curr - prev) / prev) * 100);
      }
    }

    // Calculate standard deviation
    const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
    const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length;
    const stdDev = Math.sqrt(variance);

    return stdDev;
  }

  /**
   * Add price to history
   */
  private addToHistory(symbol: string, price: number): void {
    let history = this.priceHistory.get(symbol);
    if (!history) {
      history = [];
      this.priceHistory.set(symbol, history);
    }

    history.push({ price, timestamp: Date.now() });

    // Keep only last MAX_HISTORY_POINTS
    if (history.length > this.MAX_HISTORY_POINTS) {
      history.shift();
    }
  }

  /**
   * Find closest price to a specific timestamp
   */
  private findPriceAtTime(
    history: Array<{ price: number; timestamp: number }>,
    targetTime: number
  ): number | null {
    if (history.length === 0) return null;

    // Find the price point closest to target time
    let closest = history[0];
    let minDiff = Math.abs(closest!.timestamp - targetTime);

    for (const point of history) {
      const diff = Math.abs(point.timestamp - targetTime);
      if (diff < minDiff) {
        closest = point;
        minDiff = diff;
      }
    }

    // Only return if within 30 seconds of target
    return minDiff < 30000 ? (closest?.price ?? null) : null;
  }

  /**
   * Clear price history for a symbol
   */
  clearHistory(symbol: string): void {
    this.priceHistory.delete(symbol);
  }

  /**
   * Get number of data points in history
   */
  getHistorySize(symbol: string): number {
    return this.priceHistory.get(symbol)?.length ?? 0;
  }
}

/**
 * Example usage and tests
 */
async function testPriceService() {
  console.log('\n=== Testing Price Service ===\n');

  const priceService = new PriceService();

  // Test 1: Get single price
  console.log('Test 1: Fetching SOL/USD price...');
  const solPrice = await priceService.getPrice('SOL/USD');
  if (solPrice) {
    console.log(`✅ SOL Price: $${solPrice.price.toFixed(2)}`);
    console.log(`   Confidence: ±$${solPrice.confidence.toFixed(4)}`);
  } else {
    console.log('❌ Failed to fetch SOL price');
  }

  // Test 2: Get multiple prices
  console.log('\nTest 2: Fetching multiple prices...');
  const prices = await priceService.getPrices(['SOL/USD', 'USDC/USD', 'BONK/USD']);
  prices.forEach((data, symbol) => {
    console.log(`✅ ${symbol}: $${data.price.toFixed(6)}`);
  });

  // Test 3: Simulate price history for velocity calculation
  console.log('\nTest 3: Simulating price velocity...');
  // In real usage, prices would be collected over time
  // For testing, we'll just note that history needs to accumulate
  console.log(`History points for SOL: ${priceService.getHistorySize('SOL/USD')}`);

  const velocity = priceService.getPriceVelocity('SOL/USD');
  if (velocity) {
    console.log(`✅ Price Velocity:`);
    console.log(`   Current: $${velocity.currentPrice.toFixed(2)}`);
    console.log(`   Velocity/hour: ${velocity.velocityPerHour.toFixed(2)}%`);
  } else {
    console.log('⏳ Not enough history yet for velocity calculation');
  }

  // Test 4: Volatility
  const volatility = priceService.getVolatility('SOL/USD');
  console.log(`\nTest 4: Volatility (15min window): ${volatility.toFixed(2)}%`);
}

// Run tests if called directly
if (require.main === module) {
  testPriceService().catch(console.error);
}

export default PriceService;
