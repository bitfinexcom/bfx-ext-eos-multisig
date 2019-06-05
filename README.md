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
