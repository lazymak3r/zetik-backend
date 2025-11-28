export interface IFormattedGameName {
  displayName: string;
  gameCode: string;
  developer: string;
}

export function formatProviderGameName(gameName: string): IFormattedGameName {
  const parts = (gameName || '').split(':');
  const developer = parts[0] || '';
  const gameCode = parts.length > 1 ? parts.slice(1).join(':') : parts[0];

  const toTitleCase = (str: string): string =>
    (str || '')
      .replace(/[-_]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  const humanGame = toTitleCase(gameCode || '');
  const humanProvider = toTitleCase(developer);
  const displayName = humanProvider ? `${humanGame} - ${humanProvider}` : humanGame;

  return { displayName, gameCode, developer };
}
