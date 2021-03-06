const {test} = require('tap');

const {createCluster} = require('./../macros');
const {openChannel} = require('./../../');

const channelCapacityTokens = 1e6;
const defaultFee = 1e3;
const defaultVout = 0;
const giftTokens = 1000;
const txIdHexLength = 32 * 2;

// Opening a channel should open a channel
test(`Open channel`, async ({end, equal}) => {
  const cluster = await createCluster({is_remote_skipped: true});

  const channelOpen = await openChannel({
    chain_fee_tokens_per_vbyte: defaultFee,
    give_tokens: giftTokens,
    lnd: cluster.control.lnd,
    local_tokens: channelCapacityTokens,
    partner_public_key: cluster.target_node_public_key,
    socket: `${cluster.target.listen_ip}:${cluster.target.listen_port}`,
  });

  equal(channelOpen.transaction_id.length, txIdHexLength, 'Channel tx id');
  equal(channelOpen.transaction_vout, defaultVout, 'Channel tx output index');

  await cluster.kill({});

  return end();
});
