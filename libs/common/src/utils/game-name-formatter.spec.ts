import { formatProviderGameName } from './game-name-formatter';

describe('formatProviderGameName', () => {
  describe('Standard Format (developer:game-code)', () => {
    it('should format pragmaticplay:sugar-rush correctly', () => {
      const result = formatProviderGameName('pragmaticplay:sugar-rush');
      expect(result).toEqual({
        displayName: 'Sugar Rush - Pragmaticplay',
        gameCode: 'sugar-rush',
        developer: 'pragmaticplay',
      });
    });

    it('should format evolution:mega-ball correctly', () => {
      const result = formatProviderGameName('evolution:mega-ball');
      expect(result).toEqual({
        displayName: 'Mega Ball - Evolution',
        gameCode: 'mega-ball',
        developer: 'evolution',
      });
    });

    it('should handle snake_case in game code', () => {
      const result = formatProviderGameName('netent:starburst_xxxtreme');
      expect(result).toEqual({
        displayName: 'Starburst Xxxtreme - Netent',
        gameCode: 'starburst_xxxtreme',
        developer: 'netent',
      });
    });

    it('should handle multiple hyphens', () => {
      const result = formatProviderGameName('playtech:age-of-the-gods');
      expect(result).toEqual({
        displayName: 'Age Of The Gods - Playtech',
        gameCode: 'age-of-the-gods',
        developer: 'playtech',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing developer (only game code)', () => {
      const result = formatProviderGameName('sugar-rush');
      expect(result).toEqual({
        displayName: 'Sugar Rush - Sugar Rush',
        gameCode: 'sugar-rush',
        developer: 'sugar-rush',
      });
    });

    it('should handle empty string', () => {
      const result = formatProviderGameName('');
      expect(result).toEqual({
        displayName: '',
        gameCode: '',
        developer: '',
      });
    });

    it('should handle multiple colons (preserves all parts after first colon)', () => {
      const result = formatProviderGameName('provider:game:extra');
      expect(result).toEqual({
        displayName: 'Game:extra - Provider',
        gameCode: 'game:extra',
        developer: 'provider',
      });
    });

    it('should handle whitespace in game name', () => {
      const result = formatProviderGameName('provider:game name');
      expect(result).toEqual({
        displayName: 'Game Name - Provider',
        gameCode: 'game name',
        developer: 'provider',
      });
    });

    it('should handle leading/trailing spaces (trimmed for display only)', () => {
      const result = formatProviderGameName('  provider:game-code  ');
      expect(result).toEqual({
        displayName: 'Game Code - Provider',
        gameCode: 'game-code  ',
        developer: '  provider',
      });
    });
  });

  describe('Mixed Case and Special Characters', () => {
    it('should capitalize each word correctly', () => {
      const result = formatProviderGameName('PROVIDER:GAME-CODE');
      expect(result).toEqual({
        displayName: 'Game Code - Provider',
        gameCode: 'GAME-CODE',
        developer: 'PROVIDER',
      });
    });

    it('should handle mixed hyphens and underscores', () => {
      const result = formatProviderGameName('provider:game_name-with-hyphens');
      expect(result).toEqual({
        displayName: 'Game Name With Hyphens - Provider',
        gameCode: 'game_name-with-hyphens',
        developer: 'provider',
      });
    });

    it('should handle numbers in game name', () => {
      const result = formatProviderGameName('provider:game-v2-deluxe');
      expect(result).toEqual({
        displayName: 'Game V2 Deluxe - Provider',
        gameCode: 'game-v2-deluxe',
        developer: 'provider',
      });
    });
  });

  describe('Title Case Logic', () => {
    it('should handle consecutive delimiters', () => {
      const result = formatProviderGameName('provider:game--name');
      expect(result).toEqual({
        displayName: 'Game Name - Provider',
        gameCode: 'game--name',
        developer: 'provider',
      });
    });

    it('should filter empty words from consecutive delimiters', () => {
      const result = formatProviderGameName('provider:game___name');
      expect(result).toEqual({
        displayName: 'Game Name - Provider',
        gameCode: 'game___name',
        developer: 'provider',
      });
    });
  });
});
