# ILGuard Interactive Dashboard

An interactive web application for monitoring liquidity provider positions and predicting impermanent loss in real-time.

## Features

### 🎯 Interactive Position Creation
- **Custom Parameters**: Input your own position details
  - Token pair (e.g., SOL-USDC)
  - Entry price
  - Price range (lower/upper bounds)
  - Position value
  - Monitor duration

### 📊 Real-Time Monitoring
- **Live Updates**: Position updates every 15 seconds
- **Risk Assessment**: Instant risk scoring (0-100)
- **IL Tracking**: Current and predicted impermanent loss
- **Range Detection**: Visual indicators for in-range/out-of-range status

### 🚨 Smart Alerts
- **Critical Alerts**: OUT OF RANGE positions highlighted
- **Risk Levels**: LOW / MEDIUM / HIGH / CRITICAL
- **Recommendations**: Actionable advice (MONITOR / REBALANCE / EXIT)

### 💡 Cost-Benefit Analysis
- **Worth Rebalancing**: Automatic calculation
- **Expected Savings**: Predicted IL prevention
- **Gas Cost**: Transaction cost consideration
- **Net Benefit**: Savings vs gas cost comparison

## How to Use

### Option 1: Direct File Open
```bash
# Open directly in browser
npm run app

# Or manually open the file
open dashboard/app.html
```

### Option 2: Local Server
```bash
# Using npx serve
npm run app:serve

# Then visit: http://localhost:3000/app.html
```

## User Guide

### 1. Create a Position
Fill in the form fields:
- **Token Pair**: The LP pair you want to monitor (default: SOL-USDC)
- **Entry Price**: The price when you entered the position
- **Lower Price**: Bottom of your price range
- **Upper Price**: Top of your price range
- **Position Value**: Total value in USD
- **Monitor Duration**: How long to monitor (30-300 seconds)

### 2. Start Monitoring
Click **"Start Monitoring"** button:
- System collects market data
- Calculates initial risk assessment
- Begins real-time updates every 15 seconds
- Logs all events to monitoring panel

### 3. View Results
The dashboard displays:
- **Current Price**: Real-time market price
- **Position Value**: Current value including IL
- **Current IL**: Impermanent loss percentage
- **Predicted IL**: Forecasted IL in next 30 minutes
- **Risk Score**: Comprehensive risk rating (0-100)
- **In Range**: Whether position is earning fees

### 4. Read Recommendations
The system provides:
- **Action**: What to do (MONITOR / REBALANCE / EXIT)
- **Urgency**: Priority level (LOW / MEDIUM / HIGH / CRITICAL)
- **Worth Rebalancing**: Economic viability assessment
- **Expected Savings**: How much IL can be prevented
- **Reasoning**: Clear explanation of the recommendation

### 5. Monitor Live Updates
- View real-time updates in the monitoring log
- Critical alerts are highlighted in red
- Stop monitoring anytime with "Stop Monitoring" button
- Monitoring auto-stops after specified duration

## Example Scenarios

### Scenario 1: OUT OF RANGE Position
**Input:**
- Entry Price: $100
- Range: $90 - $110
- Current Price: $84 (OUT OF RANGE)

**Result:**
- Risk Level: **CRITICAL**
- Action: **REBALANCE**
- Urgency: **CRITICAL**
- Reasoning: Position not earning fees, rebalance immediately

### Scenario 2: Healthy Position
**Input:**
- Entry Price: $100
- Range: $80 - $120
- Current Price: $84 (IN RANGE)

**Result:**
- Risk Level: **LOW**
- Action: **MONITOR**
- Urgency: **LOW**
- Reasoning: Position healthy, continue monitoring

### Scenario 3: High IL Risk
**Input:**
- Entry Price: $100
- Range: $95 - $105
- Current Price: $120 (OUT OF RANGE)
- High predicted IL

**Result:**
- Risk Level: **HIGH/CRITICAL**
- Action: **REBALANCE** or **EXIT**
- Urgency: **HIGH**
- Worth Rebalancing: Depends on cost-benefit analysis

## Technical Details

### How It Works

**1. IL Calculation**
Uses the standard concentrated liquidity formula:
```
IL = (2 * sqrt(price_ratio) / (1 + price_ratio) - 1) * 100
```

**2. Risk Scoring**
Weighted components:
- Current IL: 30%
- Predicted IL: 40%
- Out of Range: 20%
- Volatility: 10%

**3. Rebalancing Decision**
```javascript
Expected Savings = Predicted IL * 0.7 (70% prevention)
Net Benefit = Expected Savings - Gas Cost
Worth Rebalancing = Expected Savings > (Gas Cost * 10)
```

**4. Mock Price Data**
For demo purposes, prices are simulated with:
- Base price ~$84 (realistic SOL price)
- Small random fluctuations (0.2% volatility)
- Updates every 15 seconds

### Future Enhancements

**Phase 2: Backend Integration**
- Connect to actual Pyth Network price feeds
- Real Orca Whirlpools position data
- WebSocket for instant updates
- Multiple position monitoring

**Phase 3: Advanced Features**
- Historical IL charts
- Performance analytics
- Multi-wallet support
- Mobile app
- Push notifications

## Comparison: CLI Demo vs Interactive Dashboard

| Feature | CLI Demo | Interactive Dashboard |
|---------|----------|----------------------|
| **Input Method** | Hardcoded config | User form input |
| **Flexibility** | Limited to preset values | Any values |
| **Real-time Updates** | Terminal output | Visual interface |
| **User Experience** | Technical users only | Anyone can use |
| **Price Data** | Live Pyth feeds | Simulated for demo |
| **Position Tracking** | Mock positions | Mock positions |
| **Monitoring** | 60 seconds fixed | User-configurable |

## Benefits

✅ **No Installation Required** - Pure HTML/CSS/JavaScript
✅ **Works Offline** - No backend needed for demo
✅ **Cross-Platform** - Runs in any modern browser
✅ **Mobile Friendly** - Responsive design
✅ **Fast** - Instant load time
✅ **Educational** - Learn about IL and risk management
✅ **Customizable** - Test different scenarios

## Use Cases

1. **Learning Tool**: Understand how IL works with different parameters
2. **Risk Assessment**: Evaluate potential positions before deployment
3. **Demo/Presentation**: Show ILGuard capabilities to stakeholders
4. **Testing**: Validate risk scoring logic with various scenarios
5. **Decision Support**: Get immediate feedback on position health

## Browser Compatibility

Tested on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Known Limitations

**Demo Mode:**
- Uses simulated price data (not live Pyth feeds)
- Mock volatility calculations
- Simplified IL predictions
- No blockchain integration

**Production Version Would Include:**
- Real Pyth Network price feeds
- Actual Orca Whirlpool positions
- WebSocket connections
- Backend API for complex calculations
- Database for historical tracking
- User authentication
- Multi-position management

## Support

For issues or questions:
- GitHub: https://github.com/areydra/ilguard
- Forum: https://forum.colosseum.com

---

**Built for the Colosseum Agent Hackathon**
