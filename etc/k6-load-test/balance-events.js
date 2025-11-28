import ws from 'k6/ws';

export function listenBalanceUpdates(token, domain) {
  const wsUrl = `${domain.replace('http', 'ws')}/notifications?token=${token}`;

  console.log(`Connecting to balance notifications: ${wsUrl}`);

  const response = ws.connect(wsUrl, {}, function (socket) {
    let connected = false;

    socket.on('open', () => {
      console.log('WebSocket opened');
    });

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data);

        if (!connected && (message.userId || message.message)) {
          connected = true;
          console.log(`✅ Connected to notifications`);
        }

        if (message.type === 'notification' && message.data?.type === 'balance_update') {
          const balanceData = message.data.data;
          console.log(
            `💰 Balance: ${balanceData.operation} ${balanceData.amount} ${balanceData.asset} -> ${balanceData.newBalance}`,
          );
        }
      } catch (e) {
        console.warn(`Failed to parse notification: ${e}`);
      }
    });

    socket.on('error', (error) => {
      console.error(`❌ WebSocket error: ${error}`);
    });

    socket.on('close', () => {
      console.log('WebSocket closed');
    });

    // Keep connection alive for test duration
    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });

  return response;
}
