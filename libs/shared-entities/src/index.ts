export * from './database-schemas';
export * from './validators/asset-address.validator';

// Re-export from @zetik/common (avoid circular dependencies)
export { GameTypeEnum } from '@zetik/common';

// Game display names
export { GAME_DISPLAY_NAMES } from './games/user-bet.entity';

// admin schema
export * from './admin/admin-audit-log.entity';
export * from './admin/admin-role.enum';
export * from './admin/admin.entity';
export * from './admin/api-key.entity';
export * from './admin/system-setting.entity';

// affiliate schema
export * from './affiliate/affiliate-campaign.entity';
export * from './affiliate/affiliate-commission-history.entity';
export * from './affiliate/affiliate-commission.entity';
export * from './affiliate/affiliate-earnings.entity';
export * from './affiliate/affiliate-statistic.entity';
export * from './affiliate/affiliate-wallet.entity';
export * from './affiliate/enums/affiliate-commission-operation.enum';

// balance schema
export * from './balance/balance-history.entity';
export * from './balance/balance-statistic.entity';
export * from './balance/balance-wallet.entity';
export * from './balance/currency-rate-history.entity';
export * from './balance/enums/asset-type.enum';
export * from './balance/enums/balance-history-status.enum';
export * from './balance/enums/balance-operation-result.enum';
export * from './balance/enums/balance-operation.enum';
export * from './balance/enums/bet-source.enum';
export * from './balance/enums/vault-direction.enum';
export * from './balance/fiat-rate-history.entity';
export * from './balance/vault-history.entity';
export * from './balance/vault.entity';

// blog schema
export * from './blog/blog-article-content-type.enum';
export * from './blog/blog-article-tag.enum';
export * from './blog/blog-article.entity';

// bonus schema
export * from './bonus/bonus-calculation-log.entity';
export * from './bonus/bonus-notification.entity';
export * from './bonus/bonus-transaction.entity';
export * from './bonus/bonus-vip-tier.entity';
export * from './bonus/enums/bonus-calculation-status.enum';
export * from './bonus/enums/bonus-job-type.enum';
export * from './bonus/enums/bonus-transaction-status.enum';
export * from './bonus/enums/bonus-type.enum';
export * from './bonus/enums/promocode-audit-action.enum';
export * from './bonus/enums/promocode-status.enum';
export * from './bonus/enums/race-duration.enum';
export * from './bonus/enums/race-status.enum';
export * from './bonus/enums/race-type.enum';
export * from './bonus/enums/vip-transfer-casino.enum';
export * from './bonus/enums/vip-transfer-tag.enum';
export * from './bonus/monthly-race-prize.entity';
export * from './bonus/promocode-audit.entity';
export * from './bonus/race-participant.entity';
export * from './bonus/race.entity';
export * from './bonus/rakeback.entity';
export * from './bonus/user-vip-status.entity';
export * from './bonus/vip-transfer-submission.entity';
export * from './bonus/weekly-race-prize.entity';
export * from './promocodes/promocode-claim.entity';
export * from './promocodes/promocode.entity';

// chat schema
export * from './chat/chat-message.entity';
export * from './chat/chat.entity';
export * from './chat/enums/chat-message-type.enum';
export * from './chat/interfaces/tip-metadata.interface';

// games schema
export * from './bonus/st8-bonus.entity';
export * from './games/blackjack-game.entity';
export * from './games/crash-bet.entity';
export * from './games/crash-game-state.entity';
export * from './games/crash-game.entity';
export * from './games/crash-seed.entity';
export * from './games/dice-bet.entity';
export * from './games/game-result.entity';
export * from './games/game-session.entity';
export * from './games/house-edge.entity';
export * from './games/keno-game.entity';
export * from './games/limbo-game.entity';
export * from './games/mines-game.entity';
export * from './games/plinko-game.entity';
export * from './games/provider-category.entity';
export * from './games/provider-developer.entity';
export * from './games/provider-game-session.entity';
export * from './games/provider-game.entity';
export * from './games/roulette-game.entity';
export * from './games/seed-pair.entity';
export * from './games/slot-image.entity';
export * from './games/user-bet.entity';
export * from './games/user-game-favorites.entity';
export * from './games/user-provider-game-favorites.entity';
export * from './games/user-recent-games.entity';

// payments schema
export * from './payments/asset.entity';
export * from './payments/transaction.entity';
export * from './payments/wallet.entity';
export * from './payments/withdraw-request.entity';

// users schema
export * from './users/daily-gambling-stats.entity';
export * from './users/default-avatar.entity';
export * from './users/email-verification.entity';
export * from './users/enums/auth-strategy.enum';
export * from './users/enums/mail-token-type.enum';
export * from './users/enums/moderation-action-type.enum';
export * from './users/mail-token.entity';
export * from './users/notification.entity';
export * from './users/phone-verification.entity';
export * from './users/refresh-token.entity';
export * from './users/self-exclusion.entity';
export * from './users/session-tracking.entity';
export * from './users/user-avatar.entity';
export * from './users/user-ignored-user.entity';
export * from './users/user-moderation-history.entity';
export * from './users/user-verification.entity';
export * from './users/users.entity';

// games schema - includes our bet limits entities
export * from './games/game-bet-limits.entity';
export * from './games/game-bet-type-limits.entity';
export * from './games/game-config.entity';
export * from './games/house-edge.entity';

// sportsbook schema
export * from './sportsbook/sportsbook-bet.entity';

// utils
export * from './utils';
