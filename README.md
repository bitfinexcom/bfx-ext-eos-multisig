# bfx-ext-eos-multisig

Open source C++ to JS port.


A setup will need one `proc` worker (`proc.sign.eos.ext.wrk.js`).

It will pull open transactions from the contract gateways via the HTTP API of the main and sidechain.

It creates an *unsigned* transaction and sends it to the network, to the api workers (`api.sign.eos.ext.wrk.js`)
for signing.

Once the amount of required signatures is reached, the transaction is sent to the chain.

## Setup

Run two Grapes:

```
grape --dp 20001 --aph 30001 --bn '127.0.0.1:20002'
grape --dp 20002 --aph 40001 --bn '127.0.0.1:20001'
```

```
# Add base as upstream:
git remote add upstream https://github.com/bitfinexcom/bfx-ext-js

# Configure service:
bash setup-config.sh


# setup dev ssl certs (use just in dev!):
cp -R sec-test sec

# add a dev key to run integration tests:
# in eosmultisig.ext.json set for main/side:

"privateKey": "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3"
```

Setup a useraccount with multiple keys, example for an existing account
(`testuser1511`):

```
PRIVATE_KEY='SECRET'

# create dev wallet
./cleos wallet create --name devwallet --file devwallet
cat devwallet # your secret wallet key

# unlock wallet
./cleos wallet unlock -n devwallet

# import key for user
./cleos wallet import -n devwallet --private-key $PRIVATE_KEY

# change permissions to use 2 keys for testuser1511@active
# references two public keys:
cleos set account permission testuser1511 active '{"threshold" : 100, "keys" : [{"key": "EOS6jLRVDbXkjsRELh4g4mdrGwSSzwCvWhPBjU7vynsTvvzwsHEfM","weight": 50}, {"key": "EOS8avaS8TiqEhzoZ8kMKnhSXuRpJ1NyLeSkJcX2eWYW5vtEzGESM","weight": 50}]}' -p testuser1511@owner

# verify changed keys
./cleos get account testuser1511


# set public keys as `requiredKeys` in eosmultisig.ext.json

```

### Boot workers

```
node worker.js --env=development --wtype=wrk-ext-eos-sign-proc

node worker.js --env=development --wtype=wrk-ext-eos-sign-api  --apiPort 8338 --chain=main
node worker.js --env=development --wtype=wrk-ext-eos-sign-api  --apiPort 8337 --chain=main

node worker.js --env=development --wtype=wrk-ext-eos-sign-api  --apiPort 7338 --chain=side
node worker.js --env=development --wtype=wrk-ext-eos-sign-api  --apiPort 7337 --chain=side


# to speed up developments and review, in development mode, passing of keys is possible via commandline:

node worker.js --env=development --wtype=wrk-ext-eos-sign-api  --apiPort 8338 --chain=main --key=secret
```

### Debugging

To see if the workers are reachable from another machine, run:

```
node test-grapes.js
```

It should print the IPs it will send the requests to and the request should fail with "outdated tx".

Use `test.js` for running tests where users transfer tokens between main and sidechain.

### Contract details / implementation details

Ids in contract tables are increasing over time. To release **all** valid pending transactions, just the
id of the oldest valid one is required, the contract will care of the other ids.

Validation is done by comparing the time of the last irreversible block with the time stored in the table entry.

`nexttrsid` is currently not used.


## Grenache API

### action: 'sign'

  - `args <Array>`
    - `0 <Object>`
      - `tx <String>` Tx Uint8 Array encoded as hex
      - `exp <String>` Expiry time of tx


**Response:**

  - `<Object>` tx status

**Example Payload:**

```js
{ tx:
   'EFD7145D65066DE414CA0000000001C0339BCEC8AEA65B00D4A44961A3A2BA01C0339BCEC8AEA65B00000000A8ED3232080C0000000000000000',
  exp: '2019-06-27T14:51:27.000' }
```

**Example Response:**

```js
{ sentToChain: true }
```

Example: [example.js](example.js)
