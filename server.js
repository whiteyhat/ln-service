const {log} = console;

const http = require('http');
const https = require('https');
const {join} = require('path');
const {readFileSync} = require('fs');

const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');
const compress = require('compression')();
const config = require('dotenv').config();
const cors = require('cors');
const express = require('express');
const logger = require('morgan');
const walnut = require('walnut');
const WebSocketServer = require('ws').Server;

const {addressesRouter} = require('./routers');
const {authorizer} = require('./routers');
const {balanceRouter} = require('./routers');
const {channelsRouter} = require('./routers');
const {connectionsRouter} = require('./routers');
const {cryptoRouter} = require('./routers');
const {exchangeRouter} = require('./routers');
const {historyRouter} = require('./routers');
const {invoicesRouter} = require('./routers');
const {lightningDaemon} = require('./lightning');
const {localLnd} = require('./service');
const {networkInfoRouter} = require('./routers');
const {paymentsRouter} = require('./routers');
const {peersRouter} = require('./routers');
const {purchasedRouter} = require('./routers');
const {rowTypes} = require('./lightning');
const {subscribeToInvoices} = require('./push');
const {subscribeToTransactions} = require('./push');
const {transactionsRouter} = require('./routers');
const {unlockWallet} = require('./lightning');
const {verifyClient} = require('./push');
const {walletInfoRouter} = require('./routers');

const {LNSERVICE_LND_DIR} = process.env;
const {NODE_ENV} = process.env;
const {PORT} = process.env;

const app = express();
const httpsPort = 18554;
const logFormat = ':method :url :status - :response-time ms - :user-agent';
const port = PORT || 10553;

const server = app
  .listen(port, () => log(null, `Listening HTTP on port: ${port}`))
  .on('error', err => log([500, 'ListenError', err]));

const [cert, key] = ['cert', 'key']
  .map(extension => join(LNSERVICE_LND_DIR, `tls.${extension}`))
  .map(n => readFileSync(n, 'utf8'));

const httpsServer = https.createServer({cert, key}, app);

const wss = [
  new WebSocketServer({server, verifyClient}),
  new WebSocketServer({server: httpsServer, verifyClient}),
];

const lnd = localLnd({});

httpsServer.listen(httpsPort);

app.disable('x-powered-by');
app.use(compress);
app.use(cors());
app.use(bodyParser.json());
app.use(logger(logFormat));
app.use(basicAuth({authorizer, authorizeAsync: true}));

app.use('/v0/addresses', addressesRouter({lnd, log}));
app.use('/v0/balance', balanceRouter({lnd, log}));
app.use('/v0/channels', channelsRouter({lnd, log}));
app.use('/v0/connections', connectionsRouter({lnd, log}));
app.use('/v0/crypto', cryptoRouter({lnd, log}));
app.use('/v0/exchange', exchangeRouter({log}));
app.use('/v0/history', historyRouter({lnd, log}));
app.use('/v0/invoices', invoicesRouter({lnd, log, wss}));
app.use('/v0/network_info', networkInfoRouter({lnd, log}));
app.use('/v0/payments', paymentsRouter({lnd, log, wss}));
app.use('/v0/peers', peersRouter({lnd, log}));
app.use('/v0/purchased', purchasedRouter({lnd, log}));
app.use('/v0/transactions', transactionsRouter({lnd, log, wss}));
app.use('/v0/wallet_info', walletInfoRouter({lnd, log}));

subscribeToInvoices({lnd, log, wss});
subscribeToTransactions({lnd, log, wss});

if (NODE_ENV !== 'production') {
  walnut.check(require('./package'));
}

