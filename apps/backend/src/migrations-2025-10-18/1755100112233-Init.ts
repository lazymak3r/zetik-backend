import { QueryRunner } from 'typeorm';

export class Init1755100112233 {
  name = 'Init1755100112233';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "admin"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "affiliate"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "balance"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "blog"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "bonus"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "chat"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "games"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "payments"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "users"');
    await queryRunner.query(
      `CREATE TABLE "affiliate"."affiliate_campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "name" character varying NOT NULL, "description" character varying, "totalCommission" character varying NOT NULL DEFAULT '0', "totalReferrals" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5904cdb265fe3b60cd879455399" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "affiliate"."affiliate_commissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaignId" uuid NOT NULL, "campaignOwnerId" uuid NOT NULL, "referredUserId" uuid NOT NULL, "amount" numeric(20,8) NOT NULL DEFAULT '0', "depositAmount" numeric(20,8) NOT NULL DEFAULT '0', "asset" character varying(10) NOT NULL, "rate" numeric(20,8) NOT NULL DEFAULT '0', "amountCents" numeric(20,2) NOT NULL DEFAULT '0', "depositAmountCents" numeric(20,2) NOT NULL DEFAULT '0', "operationId" character varying NOT NULL, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_77280f803a87debac03319456b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4a5737229560ccca1a26d6bf33" ON "affiliate"."affiliate_commissions" ("campaignId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ee610f09163fa0f24fe7063ebe" ON "affiliate"."affiliate_commissions" ("campaignOwnerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_554d7b8767ae7c6d905f10ff7d" ON "affiliate"."affiliate_commissions" ("referredUserId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "balance"."balance_history" ("operationId" character varying NOT NULL, "operation" character varying NOT NULL, "amount" numeric(20,8) NOT NULL DEFAULT '0', "asset" character varying(10) NOT NULL, "rate" numeric(20,8) NOT NULL DEFAULT '0', "amountCents" numeric(20,2) NOT NULL DEFAULT '0', "previousBalance" numeric(20,8) NOT NULL DEFAULT '0', "userId" uuid NOT NULL, "metadata" jsonb, "status" character varying NOT NULL DEFAULT 'confirmed', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_189fd1735da367da79e1685aaa6" PRIMARY KEY ("operationId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4ce2b7150a66125a7a5d61a4b3" ON "balance"."balance_history" ("userId", "operation", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ad40c9e1ea1c51ae894981335" ON "balance"."balance_history" ("userId", "operation") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7799dd3b307c1452f0dee32666" ON "balance"."balance_history" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "balance"."balance_statistics" ("userId" uuid NOT NULL, "deps" numeric(20,2) NOT NULL DEFAULT '0', "withs" numeric(20,2) NOT NULL DEFAULT '0', "bets" numeric(20,2) NOT NULL DEFAULT '0', "wins" numeric(20,2) NOT NULL DEFAULT '0', "refunds" numeric(20,2) NOT NULL DEFAULT '0', "betCount" integer NOT NULL DEFAULT '0', "winCount" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_93d5a0912c5ce68fdc1e3db5568" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "balance"."wallets_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "balance"."wallets" ("userId" uuid NOT NULL, "asset" "balance"."wallets_asset_enum" NOT NULL, "balance" numeric(20,8) NOT NULL DEFAULT '0', "isPrimary" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5d0c1953a4fff9191a6eda461c1" PRIMARY KEY ("userId", "asset"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5d0c1953a4fff9191a6eda461c" ON "balance"."wallets" ("userId", "asset") `,
    );
    await queryRunner.query(
      `CREATE TABLE "balance"."currency_rate_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "asset" character varying NOT NULL, "rate" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_85568e507b954bcec4f51cae006" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "balance"."fiat_rate_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "currency" character varying NOT NULL, "rate" numeric(18,8) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_99583eec4164bf22129eea67db7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "blog"."blog_articles" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "slug" character varying NOT NULL, "content" text NOT NULL, "subTitle" character varying, "cover" character varying NOT NULL, "tags" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "endsAt" TIMESTAMP, "updatedBy" uuid, "isPublished" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_f9410d5b00288f82a69abd1c804" UNIQUE ("slug"), CONSTRAINT "PK_7e7a57a75e6fdde30b6f368bb76" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "bonus"."bonus_calculation_logs_jobtype_enum" AS ENUM('DAILY_BONUS', 'WEEKLY_BONUS', 'MONTHLY_BONUS', 'BONUS_EXPIRATION')`,
    );
    await queryRunner.query(
      `CREATE TYPE "bonus"."bonus_calculation_logs_status_enum" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bonus"."bonus_calculation_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "jobType" "bonus"."bonus_calculation_logs_jobtype_enum" NOT NULL, "periodFrom" date NOT NULL, "periodTo" date NOT NULL, "jobId" character varying(255) NOT NULL, "status" "bonus"."bonus_calculation_logs_status_enum" NOT NULL DEFAULT 'PENDING', "usersProcessed" integer NOT NULL DEFAULT '0', "usersFailed" integer NOT NULL DEFAULT '0', "totalBonusAmount" numeric(20,8) NOT NULL DEFAULT '0.00000000', "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, "errorMessage" text, "metadata" json, "userErrors" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bonus_calculation_period" UNIQUE ("jobType", "periodFrom", "periodTo"), CONSTRAINT "PK_6977fb4637de36b55406c7c1606" PRIMARY KEY ("id")); COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."jobType" IS 'Type of bonus calculation job'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."periodFrom" IS 'Start date of the calculation period'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."periodTo" IS 'End date of the calculation period'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."jobId" IS 'Unique job ID from Bull queue'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."status" IS 'Current status of the job execution'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."usersProcessed" IS 'Number of users successfully processed'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."usersFailed" IS 'Number of users that failed processing'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."totalBonusAmount" IS 'Total bonus amount distributed'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."startedAt" IS 'When the job execution started'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."completedAt" IS 'When the job execution completed'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."errorMessage" IS 'Error message if job failed'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."metadata" IS 'Additional metadata and execution details'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."userErrors" IS 'Array of error messages for individual users'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."createdAt" IS 'When this log record was created'; COMMENT ON COLUMN "bonus"."bonus_calculation_logs"."updatedAt" IS 'When this log record was last updated'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bonus_calculation_completed" ON "bonus"."bonus_calculation_logs" ("jobType", "periodFrom", "periodTo", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bonus_calculation_status" ON "bonus"."bonus_calculation_logs" ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bonus_calculation_period" ON "bonus"."bonus_calculation_logs" ("jobType", "periodFrom", "periodTo") `,
    );
    await queryRunner.query(
      `CREATE TABLE "bonus"."bonus_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "bonusTransactionId" uuid NOT NULL, "type" character varying(100) NOT NULL, "title" character varying(255) NOT NULL, "message" text NOT NULL, "data" jsonb, "isViewed" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "viewedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "PK_471849a6297c219bad11c3f1b36" PRIMARY KEY ("id")); COMMENT ON COLUMN "bonus"."bonus_notifications"."userId" IS 'User ID who should receive the notification'; COMMENT ON COLUMN "bonus"."bonus_notifications"."bonusTransactionId" IS 'Related bonus transaction ID'; COMMENT ON COLUMN "bonus"."bonus_notifications"."type" IS 'Type of notification'; COMMENT ON COLUMN "bonus"."bonus_notifications"."title" IS 'Notification title'; COMMENT ON COLUMN "bonus"."bonus_notifications"."message" IS 'Notification message'; COMMENT ON COLUMN "bonus"."bonus_notifications"."data" IS 'Additional notification data'; COMMENT ON COLUMN "bonus"."bonus_notifications"."isViewed" IS 'Whether the notification has been viewed by the user'`,
    );
    await queryRunner.query(
      `CREATE TYPE "bonus"."bonuses_transactions_status_enum" AS ENUM('PENDING', 'CLAIMED', 'EXPIRED', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bonus"."bonuses_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "bonus"."bonuses_transactions_status_enum" NOT NULL DEFAULT 'PENDING', "userId" uuid NOT NULL, "bonusType" character varying(50) NOT NULL, "amount" numeric(12,2) NOT NULL, "description" character varying(255), "relatedVipTierLevel" smallint, "metadata" jsonb, "expiresAt" TIMESTAMP, "updatedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "claimedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "PK_66c7db467999e56c80df7f8996a" PRIMARY KEY ("id")); COMMENT ON COLUMN "bonus"."bonuses_transactions"."userId" IS 'User ID who received the bonus'; COMMENT ON COLUMN "bonus"."bonuses_transactions"."bonusType" IS 'Type of bonus awarded'; COMMENT ON COLUMN "bonus"."bonuses_transactions"."amount" IS 'Amount of the bonus awarded in cents'; COMMENT ON COLUMN "bonus"."bonuses_transactions"."relatedVipTierLevel" IS 'VIP Tier level related to this bonus (e.g. for LevelUp)'; COMMENT ON COLUMN "bonus"."bonuses_transactions"."metadata" IS 'Additional metadata: cancellation reason, investigation data, etc.'; COMMENT ON COLUMN "bonus"."bonuses_transactions"."expiresAt" IS 'Bonus expiration date (2 days from creation for time-limited bonuses)'; COMMENT ON COLUMN "bonus"."bonuses_transactions"."updatedBy" IS 'User who last modified this transaction (claimant or canceling admin)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "bonus"."bonuses_vip_tiers" ("level" smallint NOT NULL, "name" character varying(50) NOT NULL, "description" text, "isForVip" boolean NOT NULL DEFAULT false, "imageUrl" text, "wagerRequirement" numeric(20,2) NOT NULL, "levelUpBonusAmount" numeric(10,2), "rakebackPercentage" numeric(5,2), "dailyBonusPercentage" numeric(5,2), "weeklyBonusPercentage" numeric(5,2), "monthlyBonusPercentage" numeric(5,2), "createdBy" uuid, "updatedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bc7b9cc0d4eb89d3f879f0b25f8" UNIQUE ("name"), CONSTRAINT "PK_04cb27b095f296bcb1eb54b1aaf" PRIMARY KEY ("level")); COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."isForVip" IS 'Is this a VIP tier'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."imageUrl" IS 'URL for tier image'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."wagerRequirement" IS 'Wager required to reach this level in cents'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."levelUpBonusAmount" IS 'One-time bonus for reaching this level in cents'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."rakebackPercentage" IS 'Rakeback percentage (0-100), e.g., 5.00 for 5%'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."dailyBonusPercentage" IS 'Daily bonus percentage of wager (0-100.00)'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."weeklyBonusPercentage" IS 'Weekly bonus percentage of wager (0-100.00)'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."monthlyBonusPercentage" IS 'Monthly bonus percentage of wager (0-100.00)'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."createdBy" IS 'User who created this tier'; COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."updatedBy" IS 'User who last updated this tier'`,
    );
    await queryRunner.query(
      `CREATE TABLE "bonus"."bonuses_user_vip_status" ("userId" uuid NOT NULL, "currentWager" numeric(20,2) NOT NULL DEFAULT '0', "currentVipLevel" smallint NOT NULL DEFAULT '0', "previousVipLevel" smallint NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7cf26cc69ad297fbc81c55676c4" PRIMARY KEY ("userId")); COMMENT ON COLUMN "bonus"."bonuses_user_vip_status"."currentWager" IS 'Total net wagered amount by the user (bets - refunds) in cents'; COMMENT ON COLUMN "bonus"."bonuses_user_vip_status"."currentVipLevel" IS 'Current VIP level of the user, references bonuses_vip_tiers.level'; COMMENT ON COLUMN "bonus"."bonuses_user_vip_status"."previousVipLevel" IS 'Previous VIP level, to prevent double level-up bonus payout'`,
    );
    await queryRunner.query(
      `CREATE TYPE "users"."users_currentfiatformat_enum" AS ENUM('standard', 'arabic', 'european')`,
    );
    await queryRunner.query(
      `CREATE TYPE "users"."users_currentcurrency_enum" AS ENUM('USD', 'EUR', 'MXN', 'BRL', 'JPY', 'IDR', 'CAD', 'CNY', 'DKK', 'KRW', 'INR', 'PHP', 'TRY', 'NZD', 'ARS', 'RUB', 'VND')`,
    );
    await queryRunner.query(
      `CREATE TYPE "users"."users_registrationstrategy_enum" AS ENUM('EMAIL', 'METAMASK', 'PHANTOM', 'TELEGRAM', 'GOOGLE', 'STEAM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users"."users" ("id" uuid NOT NULL, "username" character varying NOT NULL, "email" character varying, "isEmailVerified" boolean NOT NULL DEFAULT false, "displayName" character varying, "avatarUrl" character varying, "affiliateCampaignId" character varying, "currentFiatFormat" "users"."users_currentfiatformat_enum" NOT NULL DEFAULT 'standard', "currentCurrency" "users"."users_currentcurrency_enum" NOT NULL DEFAULT 'USD', "registrationStrategy" "users"."users_registrationstrategy_enum" NOT NULL, "registrationData" jsonb NOT NULL, "isBanned" boolean NOT NULL DEFAULT false, "isPrivate" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1c95f84a6c5b00fddaca7ad07" ON "users"."users" ("affiliateCampaignId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chat"."chats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "language" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0117647b3c4a4e5ff198aeb6206" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat"."messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "chatId" uuid NOT NULL, "userId" uuid NOT NULL, "message" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."blackjack_games_status_enum" AS ENUM('active', 'player_stand', 'dealer_turn', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."blackjack_games_playerhandstatus_enum" AS ENUM('active', 'stand', 'bust', 'blackjack', 'completed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."blackjack_games_splithandstatus_enum" AS ENUM('active', 'stand', 'bust', 'blackjack', 'completed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."blackjack_games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "gameSessionId" character varying, "betAmount" numeric(18,8) NOT NULL, "totalBetAmount" numeric(18,8), "totalWinAmount" numeric(18,8) DEFAULT '0', "asset" character varying NOT NULL DEFAULT 'USDT', "status" "games"."blackjack_games_status_enum" NOT NULL DEFAULT 'active', "playerCards" jsonb NOT NULL, "dealerCards" jsonb NOT NULL, "deck" jsonb NOT NULL, "splitCards" jsonb, "playerScore" integer NOT NULL DEFAULT '0', "dealerScore" integer NOT NULL DEFAULT '0', "playerSoftScore" integer NOT NULL DEFAULT '0', "dealerSoftScore" integer NOT NULL DEFAULT '0', "splitScore" integer NOT NULL DEFAULT '0', "splitSoftScore" integer NOT NULL DEFAULT '0', "isDoubleDown" boolean NOT NULL DEFAULT false, "isSplitDoubleDown" boolean NOT NULL DEFAULT false, "isInsurance" boolean NOT NULL DEFAULT false, "insuranceBet" numeric(18,8), "insuranceWin" numeric(18,8), "isSplit" boolean NOT NULL DEFAULT false, "playerHandStatus" "games"."blackjack_games_playerhandstatus_enum" NOT NULL DEFAULT 'active', "splitHandStatus" "games"."blackjack_games_splithandstatus_enum" DEFAULT 'active', "activeHand" character varying NOT NULL DEFAULT 'main', "perfectPairsBet" numeric(18,8), "twentyOnePlusThreeBet" numeric(18,8), "perfectPairsWin" numeric(18,8), "twentyOnePlusThreeWin" numeric(18,8), "winAmount" numeric(18,8), "payoutMultiplier" numeric(18,4) NOT NULL DEFAULT '2.00', "splitWinAmount" numeric(18,8), "splitPayoutMultiplier" numeric(18,4) NOT NULL DEFAULT '2.00', "serverSeed" character varying NOT NULL, "serverSeedHash" character varying NOT NULL, "clientSeed" character varying NOT NULL, "nonce" bigint NOT NULL DEFAULT '1', "gameHistory" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ae84f1c6f1b6add6cce781a7daa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8f9ee76d10243126d8e97a0a1f" ON "games"."blackjack_games" ("gameSessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_34e6e68a3faf6617cb032a638c" ON "games"."blackjack_games" ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."crash_games_status_enum" AS ENUM('WAITING', 'STARTING', 'FLYING', 'CRASHED', 'ENDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."crash_games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "games"."crash_games_status_enum" NOT NULL DEFAULT 'WAITING', "crashPoint" numeric(10,8) NOT NULL, "serverSeed" character varying(64) NOT NULL, "serverSeedHash" character varying(64) NOT NULL, "nonce" bigint NOT NULL, "startedAt" TIMESTAMP, "crashedAt" TIMESTAMP, "endedAt" TIMESTAMP, "gameData" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_785368bef4b827c6043f833cdc5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e02ee68ba82bc524c8821c34cc" ON "games"."crash_games" ("status", "nonce") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a970d866a5b2e30675fab215c7" ON "games"."crash_games" ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."crash_bets_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."crash_bets_status_enum" AS ENUM('ACTIVE', 'CASHED_OUT', 'CRASHED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."crash_bets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "crashGameId" uuid NOT NULL, "userId" uuid NOT NULL, "asset" "games"."crash_bets_asset_enum" NOT NULL, "betAmount" numeric(36,18) NOT NULL, "winAmount" numeric(36,18), "cashOutAt" numeric(10,8), "autoCashOutAt" numeric(10,8), "clientSeed" character varying(64), "status" "games"."crash_bets_status_enum" NOT NULL DEFAULT 'ACTIVE', "cashOutTime" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e35861588cf6138898c7e3609d7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b3bdc1f364e5e305cd4035502" ON "games"."crash_bets" ("crashGameId", "status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd62244488bc3238f9aed4b857" ON "games"."crash_bets" ("userId", "crashGameId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf24eeff86ecb310be806857ec" ON "games"."crash_bets" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bfa0b2c6b3562c1c5b18365336" ON "games"."crash_bets" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_274ef25fa717a7d9e1afca3026" ON "games"."crash_bets" ("crashGameId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."dice_bets_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."dice_bets_bettype_enum" AS ENUM('ROLL_OVER', 'ROLL_UNDER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."dice_bets_status_enum" AS ENUM('PENDING', 'WON', 'LOST', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."dice_bets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "gameSessionId" uuid NOT NULL, "betAmount" numeric(20,8) NOT NULL, "asset" "games"."dice_bets_asset_enum" NOT NULL DEFAULT 'USDC', "betType" "games"."dice_bets_bettype_enum" NOT NULL, "targetNumber" numeric(5,2) NOT NULL, "multiplier" numeric(10,4) NOT NULL, "winChance" numeric(5,2) NOT NULL, "rollResult" numeric(5,2), "status" "games"."dice_bets_status_enum" NOT NULL DEFAULT 'PENDING', "winAmount" numeric(20,8) NOT NULL DEFAULT '0', "clientSeed" text, "serverSeed" text, "serverSeedHash" text, "nonce" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bf9b4a09a0913a1514487403ed5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a17f33b6e75a84645fcdebf26" ON "games"."dice_bets" ("userId", "createdAt", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bdef457bc7580e011492525208" ON "games"."dice_bets" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."game_sessions_gametype_enum" AS ENUM('CRASH', 'DICE', 'MINES', 'BLACKJACK', 'ROULETTE', 'PLINKO', 'LIMBO', 'KENO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."game_sessions_status_enum" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."game_sessions_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."game_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "gameType" "games"."game_sessions_gametype_enum" NOT NULL, "status" "games"."game_sessions_status_enum" NOT NULL DEFAULT 'PENDING', "asset" "games"."game_sessions_asset_enum" NOT NULL, "betAmount" numeric(36,18) NOT NULL, "winAmount" numeric(36,18), "serverSeed" character varying(64) NOT NULL, "clientSeed" character varying(64) NOT NULL, "nonce" bigint NOT NULL, "gameConfig" json, "gameState" json, "result" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP, CONSTRAINT "PK_e25fa82d55744e55000c3288fdc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9409001f067202fa8982779257" ON "games"."game_sessions" ("asset", "betAmount") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ba6e377907fe58b3acf2b83bc5" ON "games"."game_sessions" ("userId", "completedAt", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5dcb627afe2e15958794f3d6b6" ON "games"."game_sessions" ("userId", "gameType", "status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fcb20af8df3852849aef54f805" ON "games"."game_sessions" ("gameType", "status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7fb0ac36aa43bf389425c6dc9b" ON "games"."game_sessions" ("userId", "gameType", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."game_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gameSessionId" uuid NOT NULL, "userId" uuid NOT NULL, "outcomeData" json NOT NULL, "outcomeValue" numeric(10,8) NOT NULL, "verificationHash" character varying(64) NOT NULL, "isWin" boolean NOT NULL DEFAULT false, "multiplier" numeric(36,18), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d45049161e874555e7cfe325afe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c0c90d03cf78ba783d7b89ec7" ON "games"."game_results" ("userId", "isWin", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_515ee5d784662a773f4db1dc05" ON "games"."game_results" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_235fe458892bed27b078141e4a" ON "games"."game_results" ("gameSessionId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."house_edge" ("id" SERIAL NOT NULL, "game" character varying(50) NOT NULL, "edge" numeric(5,2) NOT NULL, CONSTRAINT "UQ_43ad0e0a80c12ab021aacf89700" UNIQUE ("game"), CONSTRAINT "PK_0b9e0237202203a948be35824c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."keno_games_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."keno_games_status_enum" AS ENUM('pending', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."keno_games_risklevel_enum" AS ENUM('CLASSIC', 'LOW', 'MEDIUM', 'HIGH')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."keno_games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "gameSessionId" character varying, "betAmount" numeric(18,8) NOT NULL, "asset" "games"."keno_games_asset_enum" NOT NULL DEFAULT 'BTC', "status" "games"."keno_games_status_enum" NOT NULL DEFAULT 'pending', "riskLevel" "games"."keno_games_risklevel_enum" NOT NULL DEFAULT 'CLASSIC', "selectedNumbers" text NOT NULL, "drawnNumbers" text NOT NULL, "matches" integer NOT NULL DEFAULT '0', "winAmount" numeric(18,8), "payoutMultiplier" numeric(18,4) NOT NULL DEFAULT '0.00', "serverSeed" character varying NOT NULL, "serverSeedHash" character varying NOT NULL, "clientSeed" character varying NOT NULL, "nonce" bigint NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8e5c9c5cff638b78dfdf39524d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9b219e860cc4ff101393be84e1" ON "games"."keno_games" ("gameSessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_81503eefdabdcab4a57597dd3b" ON "games"."keno_games" ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."limbo_games_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."limbo_games_status_enum" AS ENUM('pending', 'won', 'lost', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."limbo_games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "gameSessionId" character varying, "betAmount" numeric(18,8) NOT NULL, "asset" "games"."limbo_games_asset_enum" NOT NULL DEFAULT 'BTC', "status" "games"."limbo_games_status_enum" NOT NULL DEFAULT 'pending', "targetMultiplier" numeric(18,4) NOT NULL, "resultMultiplier" numeric(18,4) NOT NULL, "winChance" numeric(18,2) NOT NULL, "winAmount" numeric(18,8), "serverSeed" character varying NOT NULL, "serverSeedHash" character varying NOT NULL, "clientSeed" character varying NOT NULL, "nonce" bigint NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4e2219dd6767dfecd4b91896340" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8acb410f85a866af96946a397e" ON "games"."limbo_games" ("gameSessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9667148a404d454965d600f2af" ON "games"."limbo_games" ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."mines_games_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."mines_games_status_enum" AS ENUM('ACTIVE', 'COMPLETED', 'BUSTED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."mines_games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "gameSessionId" uuid NOT NULL, "betAmount" numeric(20,8) NOT NULL, "asset" "games"."mines_games_asset_enum" NOT NULL DEFAULT 'USDC', "minesCount" integer NOT NULL, "minePositions" json NOT NULL, "revealedTiles" json NOT NULL DEFAULT '[]', "currentMultiplier" numeric(18,8) NOT NULL DEFAULT '1.00000000', "potentialPayout" numeric(20,8) NOT NULL DEFAULT '0', "status" "games"."mines_games_status_enum" NOT NULL DEFAULT 'ACTIVE', "finalPayout" numeric(20,8), "clientSeed" text, "serverSeed" text, "serverSeedHash" text, "nonce" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bf8bffb6d36b866e2330e567105" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df62ef5bcc590e9c16779b1d3b" ON "games"."mines_games" ("gameSessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_375774568510b1d24a8309bd96" ON "games"."mines_games" ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."plinko_games_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."plinko_games_risklevel_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."plinko_games_status_enum" AS ENUM('ACTIVE', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."plinko_games" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "asset" "games"."plinko_games_asset_enum" NOT NULL, "betAmount" numeric(18,8) NOT NULL, "riskLevel" "games"."plinko_games_risklevel_enum" NOT NULL, "rowCount" integer NOT NULL, "bucketIndex" integer NOT NULL, "multiplier" numeric(10,2) NOT NULL, "winAmount" numeric(18,8) NOT NULL, "status" "games"."plinko_games_status_enum" NOT NULL DEFAULT 'ACTIVE', "clientSeed" text NOT NULL, "serverSeed" text NOT NULL, "serverSeedHash" text NOT NULL, "nonce" integer NOT NULL, "ballPath" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b7d470e366cdc0e1175b2a7a05e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_11474f882cc7adfd4eb2ff8d8e" ON "games"."plinko_games" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_571d691167787d7479cdc4aa19" ON "games"."plinko_games" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c54cbe22a902b3b98c21c7915c" ON "games"."plinko_games" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."provider_developers" ("name" character varying NOT NULL, "code" character varying NOT NULL, "restrictedTerritories" character varying array, "prohibitedTerritories" character varying array, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3f1fd83b7a7d474cf7c31458504" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."provider_games" ("code" character varying NOT NULL, "name" character varying NOT NULL, "enabled" boolean NOT NULL, "developerName" character varying NOT NULL, "categoryName" character varying NOT NULL, "bonusTypes" character varying array, "themes" character varying array, "features" character varying array, "rtp" numeric(5,2), "volatility" numeric(5,2), "maxPayoutCoeff" character varying, "hitRatio" character varying, "funMode" boolean DEFAULT false, "releaseDate" TIMESTAMP, "deprecationDate" TIMESTAMP, "restrictedTerritories" character varying array, "prohibitedTerritories" character varying array, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ae6641de19c308f46a70ef86328" PRIMARY KEY ("code"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_63bff9398eeb53346839db9340" ON "games"."provider_games" ("enabled", "developerName") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_841364b13b28f8e5dc839c7b12" ON "games"."provider_games" ("enabled", "categoryName") `,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."provider_categories" ("name" character varying NOT NULL, "type" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5f15433b7977f21c8d49b61e4f8" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."provider_game_sessions_status_enum" AS ENUM('PENDING', 'STARTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."provider_game_sessions_currency_enum" AS ENUM('USD', 'EUR', 'MXN', 'BRL', 'JPY', 'IDR', 'CAD', 'CNY', 'DKK', 'KRW', 'INR', 'PHP', 'TRY', 'NZD', 'ARS', 'RUB', 'VND')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."provider_game_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "gameCode" character varying NOT NULL, "status" "games"."provider_game_sessions_status_enum" NOT NULL DEFAULT 'PENDING', "currency" "games"."provider_game_sessions_currency_enum" NOT NULL, "betAmount" numeric(36,18) NOT NULL DEFAULT '0', "winAmount" numeric(36,18) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "code" character varying, CONSTRAINT "PK_1d622b3c3e0efccc93fc19f809f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."roulette_games_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."roulette_games_winningcolor_enum" AS ENUM('red', 'black', 'green')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."roulette_games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "asset" "games"."roulette_games_asset_enum" NOT NULL DEFAULT 'USDC', "seedPairId" integer NOT NULL, "bets" json NOT NULL, "totalBetAmount" numeric(18,8) NOT NULL, "winningNumber" integer, "winningColor" "games"."roulette_games_winningcolor_enum", "totalPayout" numeric(18,8), "profit" numeric(18,8), "totalMultiplier" numeric(10,4) DEFAULT '0.0000', "isCompleted" boolean NOT NULL DEFAULT false, "nonce" integer NOT NULL, "clientSeed" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a8466b0c66862a81beff1105368" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1d0aa718d6798b396e44d5cf6f" ON "games"."roulette_games" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03a7e979aace840adadf68461b" ON "games"."roulette_games" ("isCompleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f162e540f6e4a931ada3926bf0" ON "games"."roulette_games" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."seed_pairs" ("id" SERIAL NOT NULL, "userId" uuid NOT NULL, "serverSeed" character varying(64) NOT NULL, "serverSeedHash" character varying(64) NOT NULL, "clientSeed" character varying(64) NOT NULL DEFAULT 'default_client_seed', "nonce" bigint NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "revealedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0675c64a662cf92f8c7caa35607" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48a30e0a9aea14ba6f6793de38" ON "games"."seed_pairs" ("userId", "isActive") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."user_bets_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."user_bets" ("game" character varying(50) NOT NULL, "gameName" character varying(50), "betId" uuid NOT NULL, "userId" uuid NOT NULL, "betAmount" numeric(20,8) NOT NULL, "asset" "games"."user_bets_asset_enum" NOT NULL, "multiplier" numeric(10,4) NOT NULL, "payout" numeric(20,8) NOT NULL DEFAULT '0', "betAmountUsd" numeric(20,4) NOT NULL DEFAULT '0', "payoutUsd" numeric(20,4) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_44cd02ac24ffe6f627fe02d537c" PRIMARY KEY ("game", "betId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2a88c6a6633a1eca2c387486bc" ON "games"."user_bets" ("game", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0c725a3a78ead22005b0a704b0" ON "games"."user_bets" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."weekly_races" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "endTime" TIMESTAMP NOT NULL, "prizePool" numeric(20,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_73ab440e6668bd72f9c09ff8071" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."weekly_race_participants" ("weeklyRaceId" uuid NOT NULL, "userId" uuid NOT NULL, "place" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e91783faf979d4650b4d8955d3f" PRIMARY KEY ("weeklyRaceId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "payments"."assets_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments"."assets" ("symbol" character varying NOT NULL, "status" "payments"."assets_status_enum" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9b4bd5b9c6fe49cd3b4342fb914" PRIMARY KEY ("symbol"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "payments"."transactions_type_enum" AS ENUM('DEPOSIT', 'WITHDRAWAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payments"."transactions_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'FAILED', 'COMPLETED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payments"."transactions_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments"."transactions" ("id" uuid NOT NULL, "userId" uuid, "type" "payments"."transactions_type_enum" NOT NULL, "status" "payments"."transactions_status_enum" NOT NULL DEFAULT 'PENDING', "amount" numeric(18,8) NOT NULL, "asset" "payments"."transactions_asset_enum" NOT NULL, "address" character varying, "isCredited" boolean NOT NULL DEFAULT false, "creditedAt" TIMESTAMP, "fbCreatedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "payments"."wallets_asset_enum" AS ENUM('BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments"."wallets" ("userId" uuid NOT NULL, "asset" "payments"."wallets_asset_enum" NOT NULL, "addresses" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5d0c1953a4fff9191a6eda461c1" PRIMARY KEY ("userId", "asset"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "payments"."withdraw_requests_status_enum" AS ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments"."withdraw_requests" ("id" character varying NOT NULL, "userId" uuid NOT NULL, "asset" character varying NOT NULL, "amount" numeric(36,18) NOT NULL, "toAddress" character varying NOT NULL, "status" "payments"."withdraw_requests_status_enum" NOT NULL DEFAULT 'PENDING', "approvedBy" uuid, "approvedAt" TIMESTAMP, "txId" character varying, "failureReason" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2dfe600c271c8d99162ef7dddbf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "users"."self_exclusions_type_enum" AS ENUM('COOLDOWN', 'TEMPORARY', 'PERMANENT', 'DEPOSIT_LIMIT', 'LOSS_LIMIT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "users"."self_exclusions_platformtype_enum" AS ENUM('SPORTS', 'CASINO', 'PLATFORM')`,
    );
    await queryRunner.query(
      `CREATE TYPE "users"."self_exclusions_period_enum" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'HALF_YEAR', 'SESSION')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users"."self_exclusions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" "users"."self_exclusions_type_enum" NOT NULL, "platformType" "users"."self_exclusions_platformtype_enum" NOT NULL DEFAULT 'PLATFORM', "period" "users"."self_exclusions_period_enum", "limitAmount" numeric(20,2), "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e1d7495b8fb4714e5e5915db6de" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "users"."mail_tokens_type_enum" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users"."mail_tokens" ("token" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "users"."mail_tokens_type_enum" NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_92e1d4c6ec3337653b25e51e9cd" PRIMARY KEY ("token"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_95d16f1d9456e12022acd075c9" ON "users"."mail_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users"."refresh_tokens" ("id" BIGSERIAL NOT NULL, "token" text NOT NULL, "user_id" uuid NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deviceInfo" character varying(255), "lastUse" TIMESTAMP NOT NULL, "ipAddress" character varying(45) NOT NULL, "location" character varying(255), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56b91d98f71e3d1b649ed6e9f3" ON "users"."refresh_tokens" ("expiresAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_user_vip_status" ADD CONSTRAINT "FK_791e76c53e09a227c993a5099af" FOREIGN KEY ("currentVipLevel") REFERENCES "bonus"."bonuses_vip_tiers"("level") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat"."messages" ADD CONSTRAINT "FK_36bc604c820bb9adc4c75cd4115" FOREIGN KEY ("chatId") REFERENCES "chat"."chats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat"."messages" ADD CONSTRAINT "FK_4838cd4fc48a6ff2d4aa01aa646" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ADD CONSTRAINT "FK_55541318f88a9b3f594206f67cd" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ADD CONSTRAINT "FK_274ef25fa717a7d9e1afca30269" FOREIGN KEY ("crashGameId") REFERENCES "games"."crash_games"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ADD CONSTRAINT "FK_dfba328b318a0576196fc60e16c" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."dice_bets" ADD CONSTRAINT "FK_114b7208b66e23605591eabb529" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."game_sessions" ADD CONSTRAINT "FK_6fafb2f50848b51f214a1cbce2f" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."game_results" ADD CONSTRAINT "FK_235fe458892bed27b078141e4ae" FOREIGN KEY ("gameSessionId") REFERENCES "games"."game_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."game_results" ADD CONSTRAINT "FK_6d7c521e6b5e4ed128101857979" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."keno_games" ADD CONSTRAINT "FK_dabdabb83c03e04086ae3b0f3a9" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."limbo_games" ADD CONSTRAINT "FK_a67dc918e3623a21b4ace28936f" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ADD CONSTRAINT "FK_dc78cf832782cd291d999250560" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."provider_games" ADD CONSTRAINT "FK_c9fb9d8da14c10f0199d8751545" FOREIGN KEY ("developerName") REFERENCES "games"."provider_developers"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."provider_games" ADD CONSTRAINT "FK_917ebe04669ae4bab8996a44507" FOREIGN KEY ("categoryName") REFERENCES "games"."provider_categories"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."provider_game_sessions" ADD CONSTRAINT "FK_c352a676aa5c2461f248422cad1" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."provider_game_sessions" ADD CONSTRAINT "FK_7cfe9adaef5c063339a2fc33cce" FOREIGN KEY ("code") REFERENCES "games"."provider_games"("code") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ADD CONSTRAINT "FK_1d0aa718d6798b396e44d5cf6f2" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."seed_pairs" ADD CONSTRAINT "FK_d34d25b62cc4ea84c1020afc043" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."weekly_race_participants" ADD CONSTRAINT "FK_9d6f701a4301f4fd83282b48d3a" FOREIGN KEY ("weeklyRaceId") REFERENCES "games"."weekly_races"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"."withdraw_requests" ADD CONSTRAINT "FK_a8f03d80e42da1162e25591dc4e" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."self_exclusions" ADD CONSTRAINT "FK_0321109caf904350ae8d77fb0e6" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."mail_tokens" ADD CONSTRAINT "FK_95d16f1d9456e12022acd075c9c" FOREIGN KEY ("user_id") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"."refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."mail_tokens" DROP CONSTRAINT "FK_95d16f1d9456e12022acd075c9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."self_exclusions" DROP CONSTRAINT "FK_0321109caf904350ae8d77fb0e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"."withdraw_requests" DROP CONSTRAINT "FK_a8f03d80e42da1162e25591dc4e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."weekly_race_participants" DROP CONSTRAINT "FK_9d6f701a4301f4fd83282b48d3a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."seed_pairs" DROP CONSTRAINT "FK_d34d25b62cc4ea84c1020afc043"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" DROP CONSTRAINT "FK_1d0aa718d6798b396e44d5cf6f2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."provider_game_sessions" DROP CONSTRAINT "FK_7cfe9adaef5c063339a2fc33cce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."provider_game_sessions" DROP CONSTRAINT "FK_c352a676aa5c2461f248422cad1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."provider_games" DROP CONSTRAINT "FK_917ebe04669ae4bab8996a44507"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."provider_games" DROP CONSTRAINT "FK_c9fb9d8da14c10f0199d8751545"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" DROP CONSTRAINT "FK_dc78cf832782cd291d999250560"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."limbo_games" DROP CONSTRAINT "FK_a67dc918e3623a21b4ace28936f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."keno_games" DROP CONSTRAINT "FK_dabdabb83c03e04086ae3b0f3a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."game_results" DROP CONSTRAINT "FK_6d7c521e6b5e4ed128101857979"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."game_results" DROP CONSTRAINT "FK_235fe458892bed27b078141e4ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."game_sessions" DROP CONSTRAINT "FK_6fafb2f50848b51f214a1cbce2f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."dice_bets" DROP CONSTRAINT "FK_114b7208b66e23605591eabb529"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" DROP CONSTRAINT "FK_dfba328b318a0576196fc60e16c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" DROP CONSTRAINT "FK_274ef25fa717a7d9e1afca30269"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" DROP CONSTRAINT "FK_55541318f88a9b3f594206f67cd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat"."messages" DROP CONSTRAINT "FK_4838cd4fc48a6ff2d4aa01aa646"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat"."messages" DROP CONSTRAINT "FK_36bc604c820bb9adc4c75cd4115"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_user_vip_status" DROP CONSTRAINT "FK_791e76c53e09a227c993a5099af"`,
    );
    await queryRunner.query(`DROP INDEX "users"."IDX_56b91d98f71e3d1b649ed6e9f3"`);
    await queryRunner.query(`DROP TABLE "users"."refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "users"."IDX_95d16f1d9456e12022acd075c9"`);
    await queryRunner.query(`DROP TABLE "users"."mail_tokens"`);
    await queryRunner.query(`DROP TYPE "users"."mail_tokens_type_enum"`);
    await queryRunner.query(`DROP TABLE "users"."self_exclusions"`);
    await queryRunner.query(`DROP TYPE "users"."self_exclusions_period_enum"`);
    await queryRunner.query(`DROP TYPE "users"."self_exclusions_platformtype_enum"`);
    await queryRunner.query(`DROP TYPE "users"."self_exclusions_type_enum"`);
    await queryRunner.query(`DROP TABLE "payments"."withdraw_requests"`);
    await queryRunner.query(`DROP TYPE "payments"."withdraw_requests_status_enum"`);
    await queryRunner.query(`DROP TABLE "payments"."wallets"`);
    await queryRunner.query(`DROP TYPE "payments"."wallets_asset_enum"`);
    await queryRunner.query(`DROP TABLE "payments"."transactions"`);
    await queryRunner.query(`DROP TYPE "payments"."transactions_asset_enum"`);
    await queryRunner.query(`DROP TYPE "payments"."transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "payments"."transactions_type_enum"`);
    await queryRunner.query(`DROP TABLE "payments"."assets"`);
    await queryRunner.query(`DROP TYPE "payments"."assets_status_enum"`);
    await queryRunner.query(`DROP TABLE "games"."weekly_race_participants"`);
    await queryRunner.query(`DROP TABLE "games"."weekly_races"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_0c725a3a78ead22005b0a704b0"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_2a88c6a6633a1eca2c387486bc"`);
    await queryRunner.query(`DROP TABLE "games"."user_bets"`);
    await queryRunner.query(`DROP TYPE "games"."user_bets_asset_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_48a30e0a9aea14ba6f6793de38"`);
    await queryRunner.query(`DROP TABLE "games"."seed_pairs"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_f162e540f6e4a931ada3926bf0"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_03a7e979aace840adadf68461b"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_1d0aa718d6798b396e44d5cf6f"`);
    await queryRunner.query(`DROP TABLE "games"."roulette_games"`);
    await queryRunner.query(`DROP TYPE "games"."roulette_games_winningcolor_enum"`);
    await queryRunner.query(`DROP TYPE "games"."roulette_games_asset_enum"`);
    await queryRunner.query(`DROP TABLE "games"."provider_game_sessions"`);
    await queryRunner.query(`DROP TYPE "games"."provider_game_sessions_currency_enum"`);
    await queryRunner.query(`DROP TYPE "games"."provider_game_sessions_status_enum"`);
    await queryRunner.query(`DROP TABLE "games"."provider_categories"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_841364b13b28f8e5dc839c7b12"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_63bff9398eeb53346839db9340"`);
    await queryRunner.query(`DROP TABLE "games"."provider_games"`);
    await queryRunner.query(`DROP TABLE "games"."provider_developers"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_c54cbe22a902b3b98c21c7915c"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_571d691167787d7479cdc4aa19"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_11474f882cc7adfd4eb2ff8d8e"`);
    await queryRunner.query(`DROP TABLE "games"."plinko_games"`);
    await queryRunner.query(`DROP TYPE "games"."plinko_games_status_enum"`);
    await queryRunner.query(`DROP TYPE "games"."plinko_games_risklevel_enum"`);
    await queryRunner.query(`DROP TYPE "games"."plinko_games_asset_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_375774568510b1d24a8309bd96"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_df62ef5bcc590e9c16779b1d3b"`);
    await queryRunner.query(`DROP TABLE "games"."mines_games"`);
    await queryRunner.query(`DROP TYPE "games"."mines_games_status_enum"`);
    await queryRunner.query(`DROP TYPE "games"."mines_games_asset_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_9667148a404d454965d600f2af"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_8acb410f85a866af96946a397e"`);
    await queryRunner.query(`DROP TABLE "games"."limbo_games"`);
    await queryRunner.query(`DROP TYPE "games"."limbo_games_status_enum"`);
    await queryRunner.query(`DROP TYPE "games"."limbo_games_asset_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_81503eefdabdcab4a57597dd3b"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_9b219e860cc4ff101393be84e1"`);
    await queryRunner.query(`DROP TABLE "games"."keno_games"`);
    await queryRunner.query(`DROP TYPE "games"."keno_games_risklevel_enum"`);
    await queryRunner.query(`DROP TYPE "games"."keno_games_status_enum"`);
    await queryRunner.query(`DROP TYPE "games"."keno_games_asset_enum"`);
    await queryRunner.query(`DROP TABLE "games"."house_edge"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_235fe458892bed27b078141e4a"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_515ee5d784662a773f4db1dc05"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_6c0c90d03cf78ba783d7b89ec7"`);
    await queryRunner.query(`DROP TABLE "games"."game_results"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_7fb0ac36aa43bf389425c6dc9b"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_fcb20af8df3852849aef54f805"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_5dcb627afe2e15958794f3d6b6"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_ba6e377907fe58b3acf2b83bc5"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_9409001f067202fa8982779257"`);
    await queryRunner.query(`DROP TABLE "games"."game_sessions"`);
    await queryRunner.query(`DROP TYPE "games"."game_sessions_asset_enum"`);
    await queryRunner.query(`DROP TYPE "games"."game_sessions_status_enum"`);
    await queryRunner.query(`DROP TYPE "games"."game_sessions_gametype_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_bdef457bc7580e011492525208"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_6a17f33b6e75a84645fcdebf26"`);
    await queryRunner.query(`DROP TABLE "games"."dice_bets"`);
    await queryRunner.query(`DROP TYPE "games"."dice_bets_status_enum"`);
    await queryRunner.query(`DROP TYPE "games"."dice_bets_bettype_enum"`);
    await queryRunner.query(`DROP TYPE "games"."dice_bets_asset_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_274ef25fa717a7d9e1afca3026"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_bfa0b2c6b3562c1c5b18365336"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_cf24eeff86ecb310be806857ec"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_fd62244488bc3238f9aed4b857"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_8b3bdc1f364e5e305cd4035502"`);
    await queryRunner.query(`DROP TABLE "games"."crash_bets"`);
    await queryRunner.query(`DROP TYPE "games"."crash_bets_status_enum"`);
    await queryRunner.query(`DROP TYPE "games"."crash_bets_asset_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_a970d866a5b2e30675fab215c7"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_e02ee68ba82bc524c8821c34cc"`);
    await queryRunner.query(`DROP TABLE "games"."crash_games"`);
    await queryRunner.query(`DROP TYPE "games"."crash_games_status_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_34e6e68a3faf6617cb032a638c"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_8f9ee76d10243126d8e97a0a1f"`);
    await queryRunner.query(`DROP TABLE "games"."blackjack_games"`);
    await queryRunner.query(`DROP TYPE "games"."blackjack_games_splithandstatus_enum"`);
    await queryRunner.query(`DROP TYPE "games"."blackjack_games_playerhandstatus_enum"`);
    await queryRunner.query(`DROP TYPE "games"."blackjack_games_status_enum"`);
    await queryRunner.query(`DROP TABLE "chat"."messages"`);
    await queryRunner.query(`DROP TABLE "chat"."chats"`);
    await queryRunner.query(`DROP INDEX "users"."IDX_f1c95f84a6c5b00fddaca7ad07"`);
    await queryRunner.query(`DROP TABLE "users"."users"`);
    await queryRunner.query(`DROP TYPE "users"."users_registrationstrategy_enum"`);
    await queryRunner.query(`DROP TYPE "users"."users_currentcurrency_enum"`);
    await queryRunner.query(`DROP TYPE "users"."users_currentfiatformat_enum"`);
    await queryRunner.query(`DROP TABLE "bonus"."bonuses_user_vip_status"`);
    await queryRunner.query(`DROP TABLE "bonus"."bonuses_vip_tiers"`);
    await queryRunner.query(`DROP TABLE "bonus"."bonuses_transactions"`);
    await queryRunner.query(`DROP TYPE "bonus"."bonuses_transactions_status_enum"`);
    await queryRunner.query(`DROP TABLE "bonus"."bonus_notifications"`);
    await queryRunner.query(`DROP INDEX "bonus"."IDX_bonus_calculation_period"`);
    await queryRunner.query(`DROP INDEX "bonus"."IDX_bonus_calculation_status"`);
    await queryRunner.query(`DROP INDEX "bonus"."IDX_bonus_calculation_completed"`);
    await queryRunner.query(`DROP TABLE "bonus"."bonus_calculation_logs"`);
    await queryRunner.query(`DROP TYPE "bonus"."bonus_calculation_logs_status_enum"`);
    await queryRunner.query(`DROP TYPE "bonus"."bonus_calculation_logs_jobtype_enum"`);
    await queryRunner.query(`DROP TABLE "blog"."blog_articles"`);
    await queryRunner.query(`DROP TABLE "balance"."fiat_rate_history"`);
    await queryRunner.query(`DROP TABLE "balance"."currency_rate_history"`);
    await queryRunner.query(`DROP INDEX "balance"."IDX_5d0c1953a4fff9191a6eda461c"`);
    await queryRunner.query(`DROP TABLE "balance"."wallets"`);
    await queryRunner.query(`DROP TYPE "balance"."wallets_asset_enum"`);
    await queryRunner.query(`DROP TABLE "balance"."balance_statistics"`);
    await queryRunner.query(`DROP INDEX "balance"."IDX_7799dd3b307c1452f0dee32666"`);
    await queryRunner.query(`DROP INDEX "balance"."IDX_1ad40c9e1ea1c51ae894981335"`);
    await queryRunner.query(`DROP INDEX "balance"."IDX_4ce2b7150a66125a7a5d61a4b3"`);
    await queryRunner.query(`DROP TABLE "balance"."balance_history"`);
    await queryRunner.query(`DROP INDEX "affiliate"."IDX_554d7b8767ae7c6d905f10ff7d"`);
    await queryRunner.query(`DROP INDEX "affiliate"."IDX_ee610f09163fa0f24fe7063ebe"`);
    await queryRunner.query(`DROP INDEX "affiliate"."IDX_4a5737229560ccca1a26d6bf33"`);
    await queryRunner.query(`DROP TABLE "affiliate"."affiliate_commissions"`);
    await queryRunner.query(`DROP TABLE "affiliate"."affiliate_campaigns"`);
  }
}
