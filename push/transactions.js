const {broadcastResponse} = require('./../push');
const subscribeToTx = require('./../lightning/subscribe_to_transactions');

const {isArray} = Array;

/** Subscribe to transactions.

  {
    lnd: <LND GRPC API Object>
    wss: [<Web Socket Server Object>]
  }

  @throws
  <Error on Invalid Arguments>
*/
module.exports = ({lnd, log, wss}) => {
  if (!lnd) {
    throw new Error('ExpectedLndToSubscribeToTransactions');
  }

  if (!log) {
    throw new Error('ExpectedLogFunctionToSubscribeToTransactions');
  }

  if (!isArray(wss)) {
    throw new Error('ExpectedWebSocketServersToPushTransactions');
  }

  const subscription = subscribeToTx({lnd});

  subscription.on('data', row => broadcastResponse({log, row, wss}));
  subscription.on('end', () => {});
  subscription.on('error', err => log([503, 'TxSubscribeErr', {err}]));
  subscription.on('status', ({}) => {});

  return;
};
