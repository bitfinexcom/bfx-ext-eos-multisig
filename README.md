# bfx-ext-eos-multisig

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

```

### Boot worker

```
node worker.js --env=development --wtype=wrk-ext-eos-multisig-api --apiPort 8337
```

## Grenache API

### action: 'getHelloWorld'

  - `args`: &lt;Array&gt;
    - `0`: &lt;Object&gt;
      - `name`: &lt;String&gt; Name to greet

**Response:**

  - &lt;String&gt; The Greeting

**Example Payload:**

```js
args: [ { name: 'Paolo' } ]
```

**Example Response:**

```js
'Hello Paolo'
```

Example: [example.js](example.js)
