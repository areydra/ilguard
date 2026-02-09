/**
 * ILGuard API Server
 *
 * Express backend that serves real Pyth Network price feeds
 * and risk assessment calculations to the dashboard
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import PriceService from './services/priceService';
import RiskScoringEngine from './services/riskScoring';
import { calculateImpermanentLoss } from './utils/ilCalculator';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(__dirname, '../dashboard')));

// Initialize services
const priceService = new PriceService();
const riskEngine = new RiskScoringEngine(priceService);
const monitor = riskEngine.getMonitor();

// Store price history for volatility calculations
let priceHistoryInitialized = false;

/**
 * Initialize price history by collecting data points
 */
async function initializePriceHistory() {
  if (priceHistoryInitialized) return;

  console.log('📊 Initializing price history...');

  // Collect 5 data points over 10 seconds
  for (let i = 0; i < 5; i++) {
    await priceService.getPrice('SOL/USD');
    await priceService.getPrice('USDC/USD');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  priceHistoryInitialized = true;
  console.log('✅ Price history initialized');
}

// Initialize on startup
initializePriceHistory().catch(console.error);

/**
 * GET /api/price/:symbol
 * Get current price for a token
 */
app.get('/api/price/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol;
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USD`;

    const price = await priceService.getPrice(formattedSymbol);

    if (!price) {
      return res.status(404).json({
        error: 'Price not found',
        symbol: formattedSymbol
      });
    }

    res.json({
      symbol: price.symbol,
      price: price.price,
      confidence: price.confidence,
      timestamp: price.timestamp
    });
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({
      error: 'Failed to fetch price',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/volatility/:symbol
 * Get volatility for a token
 */
app.get('/api/volatility/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol;
    const timeframe = parseInt(req.query.timeframe as string) || 15;
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USD`;

    const volatility = priceService.getVolatility(formattedSymbol, timeframe);

    res.json({
      symbol: formattedSymbol,
      volatility,
      timeframe
    });
  } catch (error) {
    console.error('Error calculating volatility:', error);
    res.status(500).json({
      error: 'Failed to calculate volatility',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/position/assess
 * Assess risk for a position
 */
app.post('/api/position/assess', async (req: Request, res: Response) => {
  try {
    const {
      tokenPair,
      entryPrice,
      lowerBound,
      upperBound,
      positionValue
    } = req.body;

    // Validate input
    if (!tokenPair || !entryPrice || !lowerBound || !upperBound || !positionValue) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tokenPair', 'entryPrice', 'lowerBound', 'upperBound', 'positionValue']
      });
    }

    // Parse token pair (e.g., "SOL-USDC" -> ["SOL", "USDC"])
    const [tokenA, tokenB] = tokenPair.split('-');

    // Get current price
    const priceData = await priceService.getPrice(`${tokenA}/USD`);
    if (!priceData) {
      return res.status(404).json({ error: 'Failed to fetch current price' });
    }

    const currentPrice = priceData.price;

    // Calculate IL
    const ilResult = calculateImpermanentLoss(entryPrice, currentPrice, positionValue);

    // Check if in range
    const inRange = currentPrice >= lowerBound && currentPrice <= upperBound;

    // Create mock position for risk assessment
    const position = monitor.createMockPosition(
      tokenA,
      tokenB,
      entryPrice,
      lowerBound,
      upperBound,
      positionValue
    );

    // Update with current market data
    await monitor.updatePosition(position.positionMint);

    // Calculate risk score
    const riskScore = await riskEngine.calculateRiskScore(position);

    // Get volatility
    const volatility = priceService.getVolatility(`${tokenA}/USD`, 15);

    res.json({
      currentPrice,
      positionValue: ilResult.currentValue,
      currentIL: ilResult.ilPercentage,
      currentILValue: ilResult.ilValue,
      inRange,
      volatility,
      riskScore: riskScore.riskScore,
      riskLevel: riskScore.overallRisk,
      predictedIL: riskScore.components.predictedIL,
      recommendation: {
        action: riskScore.recommendation.action,
        urgency: riskScore.recommendation.urgency,
        reasoning: riskScore.recommendation.reasoning,
        expectedSavings: riskScore.recommendation.expectedSavings,
        gasCost: riskScore.recommendation.estimatedGasCost,
        worthRebalancing: riskScore.recommendation.worthRebalancing
      },
      prediction: riskScore.prediction ? {
        predictedPrice: riskScore.prediction.predictedPrice,
        confidence: riskScore.prediction.confidence,
        riskLevel: riskScore.prediction.riskLevel
      } : null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error assessing position:', error);
    res.status(500).json({
      error: 'Failed to assess position',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    priceHistoryInitialized,
    timestamp: Date.now()
  });
});

/**
 * Serve dashboard on root
 */
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../dashboard/app.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 ILGuard API Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
  console.log(`🔌 API endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/price/:symbol`);
  console.log(`   GET  /api/volatility/:symbol`);
  console.log(`   POST /api/position/assess`);
  console.log('');
});

export default app;
