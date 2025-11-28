-- Migration to fix gameType column to be proper enum
-- This handles the conversion from varchar to enum type

BEGIN;

-- First, create the enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_bet_type_limits_gametype_enum') THEN
        CREATE TYPE games.game_bet_type_limits_gametype_enum AS ENUM (
            'blackjack',
            'crash', 
            'dice',
            'keno',
            'limbo',
            'mines',
            'plinko',
            'roulette',
            'slots'
        );
    END IF;
END $$;

-- Convert the existing column to use the enum type
-- Use USING clause to convert varchar values to enum
ALTER TABLE games.game_bet_type_limits 
    ALTER COLUMN "gameType" TYPE games.game_bet_type_limits_gametype_enum 
    USING "gameType"::games.game_bet_type_limits_gametype_enum;

COMMIT;