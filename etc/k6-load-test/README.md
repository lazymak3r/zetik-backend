# K6 Load Testing

## Setup

1. Copy env file:

   ```bash
   cp env.example env
   ```

2. Edit `env` with your settings

## Complete Workflow

### 1. Run Tests ✨ Auto-Clean

```bash
# Quick smoke test (15 seconds, 1 user)
# 🧹 Automatically cleans old reports before running
npm run test:smoke

# Load test (1 minute, up to 5 users)
# 🧹 Automatically cleans old reports before running
npm run test:load
```

### 2. Generate Beautiful HTML Reports

```bash
# Auto-generates report from latest test
npm run report:generate

# Open report in browser
npm run report:open
```

### 3. Manual Cleanup (Optional)

```bash
# Manually clean old reports
npm run clean
```

## Report Features

The HTML reports include:

- 📊 **Performance Metrics** (response times, throughput)
- 🎯 **Threshold Results** (pass/fail status)
- 📈 **Interactive Charts** and graphs
- 🎮 **Game-specific Metrics** (wins/losses)
- 🔌 **WebSocket Metrics** (connection stats)

## For Colleagues

**Quick Demo:**

1. `npm run test:smoke` - run 15 sec test (auto-cleans old data)
2. `npm run report:generate` - create beautiful report
3. Share `reports/report.html` file

**Professional Load Testing:**

1. `npm run test:load` - run 1 min load test (auto-cleans old data)
2. `npm run report:generate` - create detailed report
3. Present results to stakeholders

## Auto-Clean Feature

🧹 **Every test automatically cleans old reports** to prevent clutter:

- Removes old `*.json` and `*.html` files
- Keeps only the latest test results
- Preserves `.gitkeep` for version control
- Ensures clean, organized reports directory

## Files

- `run.js` - Main test runner (handles WebSocket events)
- `games/dice/` - DICE game tests (HTTP API only)
- `auth.js` - Login module
- `balance-events.js` - Balance monitoring (used by runner)
- `config.js` - Configuration
- `env` - Environment variables
- `reports/` - Test results (JSON + HTML, auto-cleaned)
- `generate-report.js` - Report generator
