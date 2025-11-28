#!/bin/bash

###############################################################################
# Statistical Simulation Suite Runner
#
# This script compiles and runs the statistical validation simulation suite
# with timestamped output capturing.
#
# Usage:
#   ./scripts/run-simulation-suite.sh [simulations]
#
# Examples:
#   ./scripts/run-simulation-suite.sh           # Default: 1,000,000
#   ./scripts/run-simulation-suite.sh 10000000  # 10 million
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../apps/backend"
SUITE_SCRIPT="$BACKEND_DIR/scripts/statistical-simulation-suite.ts"
OUTPUT_DIR="$SCRIPT_DIR/../output-docs/simulation-results"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUTPUT_FILE="$OUTPUT_DIR/console-output-$TIMESTAMP.txt"

# Get simulation count from argument or use default
SIMULATIONS=${1:-1000000}

# Print header
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🎲 Statistical Validation Simulation Suite Runner${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Configuration:${NC}"
echo -e "  Simulations: ${GREEN}$(printf "%'d" $SIMULATIONS)${NC}"
echo -e "  Output file: ${GREEN}$OUTPUT_FILE${NC}"
echo ""

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Check if TypeScript script exists
if [ ! -f "$SUITE_SCRIPT" ]; then
  echo -e "${RED}Error: Simulation suite script not found at $SUITE_SCRIPT${NC}"
  exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}Error: pnpm is not installed${NC}"
  exit 1
fi

echo -e "${YELLOW}Starting simulation suite...${NC}"
echo ""

# Run the simulation suite using ts-node with tsconfig-paths
# Capture both stdout and stderr to file AND display in terminal
cd "$BACKEND_DIR"

if pnpm exec ts-node -r tsconfig-paths/register "$SUITE_SCRIPT" "$SIMULATIONS" 2>&1 | tee "$OUTPUT_FILE"; then
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ Simulation suite completed successfully!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${CYAN}Console output saved to:${NC}"
  echo -e "  ${GREEN}$OUTPUT_FILE${NC}"
  echo ""
  echo -e "${CYAN}Markdown results saved to:${NC}"
  echo -e "  ${GREEN}$OUTPUT_DIR/simulation-results-*.md${NC}"
  echo ""
  exit 0
else
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}❌ Simulation suite failed!${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${CYAN}Console output saved to:${NC}"
  echo -e "  ${YELLOW}$OUTPUT_FILE${NC}"
  echo ""
  exit 1
fi
