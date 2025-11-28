#!/bin/bash
#
# Fix Stuck Split Hand 21 Games
#
# Usage:
#   ./scripts/fix-stuck-split-21-games.sh list              # List all stuck games
#   ./scripts/fix-stuck-split-21-games.sh fix [gameId]      # Fix specific game (or all if no ID)
#
# This script fixes games where split hands hit exactly 21 but didn't auto-complete.
#

set -e

ACTION="${1:-list}"
GAME_ID="${2}"

# Database connection
PSQL_CMD="docker exec -i zetik_postgres psql -U postgres -d postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Stuck Split Hand 21 Games Fix Tool ==="
echo ""

# Function to list stuck games
list_stuck_games() {
    echo "Finding stuck split games where hands hit 21..."
    echo ""

    $PSQL_CMD -t -A -F'|' <<'EOF'
SELECT
    id,
    "userId",
    status,
    "betAmount",
    "isSplit",
    "activeHand",
    "playerScore",
    "playerSoftScore",
    "playerHandStatus",
    "splitScore",
    "splitSoftScore",
    "splitHandStatus",
    "createdAt"
FROM games.blackjack_games
WHERE status = 'active'
    AND "isSplit" = true
    AND (
        -- Main hand has 21 but still active
        (("playerScore" = 21 OR "playerSoftScore" = 21) AND "playerHandStatus" = 'active')
        OR
        -- Split hand has 21 but still active
        (("splitScore" = 21 OR "splitSoftScore" = 21) AND "splitHandStatus" = 'active')
    )
ORDER BY "createdAt" DESC;
EOF

    echo ""
    echo "✅ Listing complete"
}

# Function to fix a specific game
fix_game() {
    local game_id=$1

    echo "=== Fixing Game: $game_id ==="
    echo ""

    # Fetch game details
    game_data=$($PSQL_CMD -t -A -F'|' <<EOF
SELECT
    "betAmount",
    "totalBetAmount",
    "isSplit",
    "activeHand",
    "playerCards",
    "dealerCards",
    "playerScore",
    "playerSoftScore",
    "playerHandStatus",
    "splitCards",
    "splitScore",
    "splitSoftScore",
    "splitHandStatus",
    "perfectPairsBet",
    "twentyOnePlusThreeBet"
FROM games.blackjack_games
WHERE id = '$game_id' AND status = 'active';
EOF
)

    if [ -z "$game_data" ]; then
        echo -e "${RED}❌ Game not found or already completed: $game_id${NC}"
        return 1
    fi

    # Parse game data
    IFS='|' read -r bet_amount total_bet_amount is_split active_hand player_cards dealer_cards \
                     player_score player_soft_score player_hand_status \
                     split_cards split_score split_soft_score split_hand_status \
                     perfect_pairs_bet twenty_one_plus_three_bet <<< "$game_data"

    echo "Game State:"
    echo "  Active Hand: $active_hand"
    echo "  Main Hand: Score=$player_score/$player_soft_score, Status=$player_hand_status"
    echo "  Split Hand: Score=$split_score/$split_soft_score, Status=$split_hand_status"
    echo ""

    # Determine which hands need to be completed
    player_needs_complete=false
    split_needs_complete=false

    # Check main hand
    if [ "$player_hand_status" = "active" ] && ([ "$player_score" = "21" ] || [ "$player_soft_score" = "21" ]); then
        player_needs_complete=true
        echo -e "${YELLOW}→ Main hand has 21 and is active - will mark as COMPLETED${NC}"
    fi

    # Check split hand
    if [ "$split_hand_status" = "active" ] && ([ "$split_score" = "21" ] || [ "$split_soft_score" = "21" ]); then
        split_needs_complete=true
        echo -e "${YELLOW}→ Split hand has 21 and is active - will mark as COMPLETED${NC}"
    fi

    if [ "$player_needs_complete" = false ] && [ "$split_needs_complete" = false ]; then
        echo -e "${RED}❌ No hands with 21 found that need fixing${NC}"
        return 1
    fi

    echo ""
    read -p "Apply this fix? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Aborted."
        return 0
    fi

    # Build UPDATE statement
    update_fields=""

    if [ "$player_needs_complete" = true ]; then
        update_fields="${update_fields}\"playerHandStatus\" = 'completed',"
    fi

    if [ "$split_needs_complete" = true ]; then
        update_fields="${update_fields}\"splitHandStatus\" = 'completed',"
    fi

    # Check if both hands are now done
    both_hands_done=false
    if ([ "$player_needs_complete" = true ] || [ "$player_hand_status" != "active" ]) && \
       ([ "$split_needs_complete" = true ] || [ "$split_hand_status" != "active" ]); then
        both_hands_done=true
        echo -e "${GREEN}→ Both hands are done - will complete the game${NC}"
        update_fields="${update_fields}status = 'completed',"
    fi

    # Remove trailing comma
    update_fields="${update_fields%,}"

    # Execute update
    $PSQL_CMD <<EOF
BEGIN;

-- Show before state
SELECT
    id,
    status,
    "activeHand",
    "playerHandStatus",
    "splitHandStatus"
FROM games.blackjack_games
WHERE id = '$game_id';

-- Update the game
UPDATE games.blackjack_games
SET
    $update_fields,
    "updatedAt" = NOW()
WHERE id = '$game_id';

-- Show after state
SELECT
    id,
    status,
    "activeHand",
    "playerHandStatus",
    "splitHandStatus"
FROM games.blackjack_games
WHERE id = '$game_id';

COMMIT;
EOF

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Game fixed successfully!${NC}"

        if [ "$both_hands_done" = false ]; then
            echo ""
            echo -e "${YELLOW}⚠️  Note: Game is still active - other hand may need player action${NC}"
        else
            echo ""
            echo -e "${YELLOW}⚠️  IMPORTANT: Game marked as completed but dealer logic was not run!${NC}"
            echo -e "${YELLOW}   Payouts may be incorrect. Manual payout review recommended.${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to update game${NC}"
        return 1
    fi
}

# Function to fix all stuck games
fix_all_games() {
    echo "Finding all stuck split 21 games..."
    echo ""

    # Get list of stuck game IDs
    game_ids=$($PSQL_CMD -t -A <<'EOF'
SELECT id
FROM games.blackjack_games
WHERE status = 'active'
    AND "isSplit" = true
    AND (
        (("playerScore" = 21 OR "playerSoftScore" = 21) AND "playerHandStatus" = 'active')
        OR
        (("splitScore" = 21 OR "splitSoftScore" = 21) AND "splitHandStatus" = 'active')
    )
ORDER BY "createdAt" DESC;
EOF
)

    if [ -z "$game_ids" ]; then
        echo -e "${GREEN}✅ No stuck games found!${NC}"
        return 0
    fi

    game_count=$(echo "$game_ids" | wc -l | tr -d ' ')
    echo -e "${YELLOW}Found $game_count stuck game(s)${NC}"
    echo ""

    read -p "Fix all $game_count games? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Aborted."
        return 0
    fi

    echo ""
    echo "Fixing games..."

    fixed_count=0
    failed_count=0

    while IFS= read -r game_id; do
        echo "---"
        if fix_game "$game_id"; then
            ((fixed_count++))
        else
            ((failed_count++))
        fi
        echo ""
    done <<< "$game_ids"

    echo "=== Summary ==="
    echo -e "${GREEN}✅ Fixed: $fixed_count${NC}"
    echo -e "${RED}❌ Failed: $failed_count${NC}"
}

# Main script logic
case $ACTION in
    list)
        list_stuck_games
        ;;
    fix)
        if [ -z "$GAME_ID" ]; then
            fix_all_games
        else
            fix_game "$GAME_ID"
        fi
        ;;
    *)
        echo "Usage:"
        echo "  $0 list              - List all stuck split 21 games"
        echo "  $0 fix               - Fix all stuck split 21 games"
        echo "  $0 fix <gameId>      - Fix a specific stuck game"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 fix"
        echo "  $0 fix 8a64eedb-1234-5678-9abc-def012345678"
        exit 1
        ;;
esac
