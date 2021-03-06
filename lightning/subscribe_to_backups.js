const EventEmitter = require('events');

const {backupsFromSnapshot} = require('./../backups');

/** Subscribe to backup snapshot updates

  {
    lnd: <Authenticated LND gRPC API Object>
  }

  @throws
  <Error>

  @returns
  <EventEmitter Object>

  @event 'backup'
  {
    backup: <Backup Hex String>
    channels: [{
      backup: <Backup Hex String>
      transaction_id: <Funding Transaction Id Hex String>
      transaction_vout: <Funding Transaction Output Index Number>
    }]
  }
*/
module.exports = ({lnd}) => {
  if (!lnd || !lnd.default) {
    throw new Error('ExpectedAuthenticatedLndToSubscribeToBackups');
  }

  const eventEmitter = new EventEmitter();
  const subscription = lnd.default.subscribeChannelBackups({});

  subscription.on('data', snapshot => {
    return backupsFromSnapshot(snapshot, (err, res) => {
      if (!!err) {
        const [code, message] = err;

        return eventEmitter('error', new Error(message));
      }

      return eventEmitter.emit('backup', res);
    });
  });

  subscription.on('end', () => eventEmitter.emit('end'));
  subscription.on('error', err => eventEmitter.emit('error', err));
  subscription.on('status', status => eventEmitter.emit('status', status));

  return eventEmitter;
};
