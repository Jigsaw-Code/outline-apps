const TEST_MESSAGES: {[messageId: string]: string} = {
  "server-rename": "Rename",
  "server-forget": "Remove",
  "connect-button-label": "Connect",
  "disconnect-button-label": "Disconnect",
  "disconnected-server-state": "Disconnected",
  "server-default-name-outline": "My Outline Server",
  "default-name-outline": "My Server",
  "connected-server-state": "Connected",
};

export const localize = (messageId: string): string => TEST_MESSAGES[messageId];
