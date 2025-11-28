#!/bin/bash

# Script to list and fix stuck insurance games
# Usage:
#   ./fix-stuck-insurance-games.sh list [local|dev]
#   ./fix-stuck-insurance-games.sh fix <gameId> [local|dev]

set -e

ACTION=$1
GAME_ID=$2
ENV=${3:-local}

# Database connection settings
if [ "$ENV" = "dev" ]; then
    DB_HOST="your-dev-host"
    DB_PORT="5432"
    DB_USER="postgres"
    DB_PASS="your-dev-password"
    DB_NAME="postgres"
    PSQL_CMD="PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
else
    # Local uses Docker
    PSQL_CMD="docker exec -i zetik_postgres psql -U postgres -d postgres"
fi

# Helper function to check if a hand is blackjack (value 21 with 2 cards)
is_blackjack() {
    local cards=$1

    # Count cards (count number of "rank" occurrences)
    card_count=$(echo "$cards" | grep -o '"rank"' | wc -l)

    if [ $card_count -ne 2 ]; then
        echo "false"
        return
    fi

    # Cards format: [{"rank": "A", "suit": "diamonds", "value": 11}, {"rank": "10", "suit": "hearts", "value": 10}]
    # Check if contains ACE and a 10-value card (10, J, Q, K)
    has_ace=$(echo "$cards" | grep -o '"rank": "A"' | wc -l)
    has_ten=$(echo "$cards" | grep -E '"rank": "(10|J|Q|K)"' | wc -l)

    if [ $has_ace -eq 1 ] && [ $has_ten -eq 1 ]; then
        echo "true"
    else
        echo "false"
    fi
}

# List stuck insurance games
list_stuck_games() {
    echo "=== Stuck Insurance Games ==="
    echo ""

    $PSQL_CMD -t -A -F'|' <<EOF
SELECT
    id,
    "userId",
    status,
    "betAmount",
    "isInsurance",
    "isInsuranceRejected",
    "insuranceBet",
    "insuranceWin",
    "playerCards",
    "dealerCards",
    "createdAt"
FROM games.blackjack_games
WHERE status = 'active'
    AND ("isInsurance" = true OR "isInsuranceRejected" = true)
ORDER BY "createdAt" DESC;
EOF
}

# Fix a specific stuck game
fix_game() {
    local game_id=$1

    echo "=== Fixing Game: $game_id ==="
    echo ""

    # Fetch game details
    game_data=$($PSQL_CMD -t -A -F'|' <<EOF
SELECT
    "betAmount",
    "isInsurance",
    "isInsuranceRejected",
    "insuranceBet",
    "playerCards",
    "dealerCards"
FROM games.blackjack_games
WHERE id = '$game_id';
EOF
)

    if [ -z "$game_data" ]; then
        echo "❌ Game not found: $game_id"
        exit 1
    fi

    # Parse game data
    IFS='|' read -r bet_amount is_insurance is_insurance_rejected insurance_bet player_cards dealer_cards <<< "$game_data"

    echo "Bet Amount: $bet_amount"
    echo "Is Insurance: $is_insurance"
    echo "Is Insurance Rejected: $is_insurance_rejected"
    echo "Insurance Bet: $insurance_bet"
    echo "Player Cards: $player_cards"
    echo "Dealer Cards: $dealer_cards"
    echo ""

    # Check for blackjacks
    player_has_bj=$(is_blackjack "$player_cards")
    dealer_has_bj=$(is_blackjack "$dealer_cards")

    echo "Player has blackjack: $player_has_bj"
    echo "Dealer has blackjack: $dealer_has_bj"
    echo ""

    # Calculate proper payout based on scenario
    win_amount="0"
    total_win_amount="0"
    insurance_win="0"

    if [ "$dealer_has_bj" = "true" ]; then
        # Dealer has blackjack
        if [ "$player_has_bj" = "true" ]; then
            # Both have blackjack - PUSH
            echo "Scenario: Both have blackjack (PUSH)"
            win_amount="$bet_amount"
            total_win_amount="$bet_amount"
        else
            # Only dealer has blackjack - player loses main bet
            echo "Scenario: Dealer blackjack (Player loses)"
            win_amount="0"
            total_win_amount="0"
        fi

        # Calculate insurance win if player took insurance
        if [ "$is_insurance" = "t" ]; then
            # Insurance pays 2:1 (return 3x insurance bet)
            insurance_win=$(echo "scale=8; $insurance_bet * 3" | bc)
            total_win_amount=$(echo "scale=8; $total_win_amount + $insurance_win" | bc)
            echo "Insurance wins: $insurance_win"
        fi
    else
        # Dealer does NOT have blackjack
        insurance_win="0"

        if [ "$player_has_bj" = "true" ]; then
            # Player has blackjack, dealer doesn't - player wins 3:2
            echo "Scenario: Player blackjack wins (3:2)"
            win_amount=$(echo "scale=8; $bet_amount * 2.5" | bc)
            total_win_amount="$win_amount"
        else
            # Neither has blackjack - this shouldn't happen after insurance prompt
            echo "⚠️  WARNING: Neither has blackjack - game should have continued"
            echo "This game may need manual review"
            exit 1
        fi
    fi

    echo ""
    echo "Calculated Payouts:"
    echo "  Win Amount: $win_amount"
    echo "  Insurance Win: $insurance_win"
    echo "  Total Win Amount: $total_win_amount"
    echo ""

    # Update the game
    read -p "Apply this fix? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Aborted."
        exit 0
    fi

    $PSQL_CMD <<EOF
UPDATE games.blackjack_games
SET
    status = 'completed',
    "winAmount" = '$win_amount',
    "insuranceWin" = '$insurance_win',
    "totalWinAmount" = '$total_win_amount',
    "updatedAt" = NOW()
WHERE id = '$game_id';
EOF

    if [ $? -eq 0 ]; then
        echo "✅ Game fixed successfully!"
        echo ""
        echo "⚠️  IMPORTANT: You must manually credit the player's balance!"
        echo "Run this SQL to credit the balance:"
        echo ""
        echo "UPDATE balance.balance"
        echo "SET amount = amount + $total_win_amount"
        echo "WHERE \"userId\" = (SELECT \"userId\" FROM games.blackjack_games WHERE id = '$game_id');"
    else
        echo "❌ Failed to update game"
        exit 1
    fi
}

# Main script logic
case $ACTION in
    list)
        list_stuck_games
        ;;
    fix)
        if [ -z "$GAME_ID" ]; then
            echo "Usage: $0 fix <gameId> [local|dev]"
            exit 1
        fi
        fix_game "$GAME_ID"
        ;;
    *)
        echo "Usage:"
        echo "  $0 list [local|dev]              - List all stuck insurance games"
        echo "  $0 fix <gameId> [local|dev]      - Fix a specific stuck game"
        echo ""
        echo "Environment:"
        echo "  local (default) - Uses Docker container"
        echo "  dev            - Uses remote dev server (update DB credentials in script)"
        exit 1
        ;;
esac
