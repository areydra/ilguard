# ILGuard Dashboard

A simple, beautiful dashboard for monitoring liquidity provider positions and impermanent loss risks.

## Features

- **Real-time Position Monitoring**: Track your LP positions across Orca pools
- **Risk Scoring**: Visual risk levels (LOW/MEDIUM/HIGH/CRITICAL)
- **IL Tracking**: Current and predicted impermanent loss
- **Range Indicators**: Visual representation of price ranges
- **Actionable Recommendations**: Clear guidance on when to rebalance

## How to Use

### Option 1: Open Directly
Simply open `index.html` in your web browser:
```bash
open dashboard/index.html
```

### Option 2: Serve with Simple HTTP Server
```bash
# Using Python
python3 -m http.server 3000 --directory dashboard

# Using Node.js (npx)
npx serve dashboard
```

Then visit: http://localhost:3000

## Dashboard Sections

### 1. Stats Overview
- Total Value Locked
- Current IL
- Fees Earned
- Alerts Triggered

### 2. Active Positions
Each position card shows:
- Token pair and protocol
- Risk level badge
- Position value and IL
- Price range indicator
- Current vs range status
- Recommendations
- Action buttons

### 3. Filters
- All positions
- Low risk only
- High risk only
- Out of range positions

## Future Enhancements

- [ ] Connect to live backend API
- [ ] Real-time WebSocket updates
- [ ] Historical IL charts
- [ ] Multi-wallet support
- [ ] Mobile responsive improvements
- [ ] Dark mode
- [ ] Export reports

## Tech Stack

- Pure HTML/CSS/JavaScript (no framework dependencies)
- Responsive design
- Modern UI with gradient backgrounds
- Smooth animations and transitions

## Demo Data

The dashboard currently shows demo data:
- SOL-USDC position (OUT OF RANGE, CRITICAL)
- BONK-SOL position (IN RANGE, LOW risk)

In production, this would connect to the ILGuard backend services.
