# Crypto wallet watch

A local watcher for the operative's own wallets, plus an MCP server so HQ can
answer "did I get paid?" and call out movements.

- **BTC / LTC / ETH** — polled through public explorer APIs.
- **XMR** — a **view-only** Monero wallet run through `monero-wallet-rpc`, with
  `--tx-notify` calling back on every transaction. No spend key, no private key
  on this machine.
- **One fan-out point** — `crypto-event` sends a movement to the desktop
  notification, the phone (beacon TTS), the WhatsApp HQ chat, and an append-only
  local event log.

Nothing is uploaded to a SkeletonKey server. The public chain APIs are the
explicit exception; see [Privacy](#privacy).

## Files

| File | Purpose |
|---|---|
| `crypto-watch` | Python poller for BTC/LTC (UTXO APIs) and ETH (public RPC + Blockscout). |
| `crypto-event` | Node fan-out: desktop, phone, WhatsApp, `events.jsonl`. |
| `xmr-tx-notify` | Called by `monero-wallet-rpc --tx-notify`; resolves the transfer and calls `crypto-event`. |
| `xmr-watch-setup` | Creates a view-only Monero wallet from an existing wallet; never prints keys. |
| `mcp-server.mjs` | MCP tools: `wallet_status`, `wallet_events`, `wallet_notify`. |
| `systemd/` | User units: poller timer, poller service, XMR RPC service. |
| `config.example.json` | Address list; copy to your private config path. |

## Setup

### 1. Addresses

```bash
mkdir -p ~/.config/crypto-watch
cp config.example.json ~/.config/crypto-watch/config.json
chmod 600 ~/.config/crypto-watch/config.json
```

Fill in the addresses you want to watch:

```json
{
  "btc": "bc1...",
  "ltc": "ltc1...",
  "eth": "0x..."
}
```

Empty entries are skipped. The XMR watcher uses the view-only wallet, not this
file.

### 2. MCP

```bash
cd integrations/crypto-watch
npm install
```

Register it in `~/.config/opencode/opencode.json` (see the root
[`opencode.example.json`](../../opencode.example.json)):

```json
"crypto": {
  "type": "local",
  "command": ["node", "/path/to/SkeletonKey/integrations/crypto-watch/mcp-server.mjs"],
  "cwd": "/path/to/SkeletonKey/integrations/crypto-watch",
  "enabled": true
}
```

Restart `opencode serve`. HQ can then call `wallet_status`, `wallet_events`, and
`wallet_notify`.

### 3. BTC/LTC/ETH poller

```bash
cp systemd/crypto-watch.service systemd/crypto-watch.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now crypto-watch.timer
```

The first run seeds the current transactions/balance and does not announce
history. State lives in `~/.local/state/crypto-watch/state.json`.

### 4. XMR view-only watcher (optional)

Requirements: `monero-wallet-cli` + `monero-wallet-rpc`, `curl`, `jq`, and an
existing Monero wallet.

```bash
./xmr-watch-setup /path/to/existing/wallet    # or XMR_WALLET=... ./xmr-watch-setup
cp systemd/xmr-watch.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now xmr-watch.service
```

The setup reads the address, view key, and restore height from the existing
wallet, creates a **new view-only wallet**, and stores a random RPC password in
`~/.config/xmr-watch/password` (mode 600). It never prints the view key or any
private key.

The service connects to `${XMR_NODE}` (default `nodes.hashvault.pro:18081`).
Point it at your own node for better privacy and reliability.

## Tools

| Tool | What it returns |
|---|---|
| `wallet_status` | XMR service/height/balance, poller timer, watched addresses, last events. |
| `wallet_events` | Recent `events.jsonl` rows, newest first. |
| `wallet_notify` | Broadcast a movement through the same fan-out (`crypto-event`). |

`wallet_notify` is for deliberate broadcasts; use `wallet_events` to answer
"did I get paid?" without pinging the phone.

## Privacy

- **BTC / LTC:** addresses are sent to `mempool.space` and `litecoinspace.org`.
- **ETH:** the address is sent to a public JSON-RPC node
  (`ethereum.publicnode.com` / `eth.llamarpc.com`) and to Blockscout for tx
  lookup.
- **XMR:** a view-only wallet talks to the configured remote node. Use your own
  node if the link between your IP and wallet matters.
- Watching a public chain address links that address to this machine's requests.
  Use fresh addresses where possible; do not watch someone else's wallet.

Events, config, and state stay local (`~/.local/state/crypto-watch/`,
`~/.config/crypto-watch/`). Never put a seed phrase or private key in the config.

## License

Part of SkeletonKey. See the repository [`LICENSE`](../../LICENSE). Source-
available, copyleft-style, non-commercial; forks and remixes must attribute and
notify.
