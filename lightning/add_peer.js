const asyncAuto = require('async/auto');
const asyncRetry = require('async/retry');
const isHex = require('is-hex');
const {returnResult} = require('asyncjs-util');

const getPeers = require('./get_peers');

const connectedErrMsg = /already.connected.to/;
const interval = retryCount => 10 * Math.pow(2, retryCount);
const publicKeyHexStringLength = 33 * 2;
const notSyncedError = 'chain backend is still syncing, server not active yet';
const selfKeyErrMsg = /connection.to.self/;
const times = 10;

/** Add a peer if possible (not self, or already connected)

  {
    [is_temporary]: <Add Peer as Temporary Peer Bool> // Default: false
    lnd: <Authenticated LND gRPC API Object>
    public_key: <Public Key Hex String>
    socket: <Host Network Address And Optional Port String> // ip:port
  }

  @returns via cbk or Promise
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.lnd || !args.lnd.default || !args.lnd.default.connectPeer) {
          return cbk([400, 'ExpectedLndToAddPeer']);
        }

        if (!args.public_key || !isHex(args.public_key)) {
          return cbk([400, 'ExpectedPublicKeyOfPeerToAdd']);
        }

        if (args.public_key.length !== publicKeyHexStringLength) {
          return cbk([400, 'UnexpectedLengthOfPublicKeyToAdd']);
        }

        if (!args.socket) {
          return cbk([400, 'ExpectedHostAndPortOfPeerToAdd']);
        }

        return cbk();
      },

      // Add Peer
      add: ['validate', ({}, cbk) => {
        const pubkey = args.public_key;

        return asyncRetry({interval, times}, cbk => {
          return args.lnd.default.connectPeer({
            addr: {pubkey, host: args.socket},
            perm: !args.is_temporary,
          },
          err => {
            // Exit early when the peer is already added
            if (!!err && !!err.message && connectedErrMsg.test(err.message)) {
              return cbk();
            }

            // Exit early when the peer is the self-peer
            if (!!err && !!err.message && selfKeyErrMsg.test(err.message)) {
              return cbk();
            }

            if (!!err && err.details === notSyncedError) {
              return cbk([503, 'FailedToAddPeerBecausePeerStillSyncing']);
            }

            if (!!err) {
              return cbk([503, 'UnexpectedErrorAddingPeer', {err}]);
            }

            return getPeers({lnd: args.lnd}, (err, res) => {
              if (!!err) {
                return cbk(err);
              }

              const peer = res.peers.find(n => n.public_key === pubkey);

              if (!peer) {
                return cbk([503, 'FailedToSuccessfullyConnectToRemotePeer']);
              }

              return cbk();
            });
          });
        },
        cbk);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
