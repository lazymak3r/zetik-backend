export const getGameCodeWithoutProvider = (
  gameCode: string,
  providerCode: string | undefined,
): string => {
  if (!providerCode || !gameCode.startsWith(`${providerCode}_`)) {
    return gameCode;
  }
  return gameCode.substring(providerCode.length + 1);
};
