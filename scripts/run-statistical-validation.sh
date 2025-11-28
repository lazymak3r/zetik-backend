#!/bin/bash

# 🎯 Statistical Validation Runner Script
# Runs comprehensive statistical validation tests with configurable simulation counts
#
# Usage:
#   ./scripts/run-statistical-validation.sh [SIMULATIONS] [GAME]
#
# Examples:
#   ./scripts/run-statistical-validation.sh 10000000 dice    # 10M simulations for Dice
#   ./scripts/run-statistical-validation.sh 10000000 all     # 10M simulations for all games
#   ./scripts/run-statistical-validation.sh                  # Default: 200K for all games

set -e

# Change to backend directory
cd "$(dirname "$0")/.."

# Default values
SIMULATIONS=${1:-200000}
GAME=${2:-all}

# Create output directory
OUTPUT_DIR="../../output-docs/statistical-validation-results"
mkdir -p "$OUTPUT_DIR"

# Timestamp for this run
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_FILE="$OUTPUT_DIR/validation_${TIMESTAMP}.md"

echo "🎯 Statistical Validation Test Runner"
echo "======================================"
echo "Simulations: $(printf "%'d" $SIMULATIONS)"
echo "Game: $GAME"
echo "Output: $RESULTS_FILE"
echo ""

# Start results file
cat > "$RESULTS_FILE" << EOF
# Statistical Validation Results
**Date**: $(date +"%B %d, %Y %H:%M:%S")
**Simulations**: $(printf "%'d" $SIMULATIONS) per game
**Status**: 🔄 IN PROGRESS

---

EOF

# Function to run test and capture results
run_game_test() {
    local game=$1
    local test_file=$2
    local game_name=$3

    echo "🎮 Running $game_name validation..."
    echo ""
    echo "## $game_name Game Validation" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "\`\`\`" >> "$RESULTS_FILE"

    # Run test with custom simulation count (use -F to target backend package only)
    VALIDATION_SIMULATIONS=$SIMULATIONS NODE_ENV=test pnpm -F @zetik/backend test "$test_file" --maxWorkers=1 2>&1 | tee -a "$RESULTS_FILE"

    echo "\`\`\`" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "---" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
}

# Run tests based on game selection
if [ "$GAME" = "all" ] || [ "$GAME" = "dice" ]; then
    run_game_test "dice" "dice-statistical-validation" "Dice"
fi

if [ "$GAME" = "all" ] || [ "$GAME" = "limbo" ]; then
    run_game_test "limbo" "limbo-statistical-validation" "Limbo"
fi

if [ "$GAME" = "all" ] || [ "$GAME" = "plinko" ]; then
    run_game_test "plinko" "plinko-isolated-statistical-validation" "Plinko"
fi

# Update status to complete
sed -i '' 's/🔄 IN PROGRESS/✅ COMPLETE/g' "$RESULTS_FILE"

echo ""
echo "✅ Statistical validation complete!"
echo "📄 Results saved to: $RESULTS_FILE"
echo ""
echo "Summary:"
grep -E "(Tests.*passed|PASS|FAIL)" "$RESULTS_FILE" || echo "Check results file for details"
