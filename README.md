# Offline Mode for start.gg

Offline Mode is an offline-first client for start.gg which protects your bracket from outages and lag.
It also makes your offline-first bracket available on your LAN for pool captains, production, and attendees.
Compatible with [Replay Manager](https://github.com/jmlee337/replay-manager-for-slippi/releases/latest) and [Auto Stream](https://github.com/jmlee337/auto-slp-player/releases/latest).

[![Download](https://github.com/user-attachments/assets/0f155c5c-bd25-45fb-99f7-db055a380e12)](http://github.com/jmlee337/local-cache-for-startgg/releases/latest)

## Development

Clone the repo and install dependencies:

```bash
git clone https://github.com/jmlee337/local-cache-for-startgg.git
cd local-cache-for-startgg
npm install
```

I use `node` version 22. Try switching to that if `npm install` still fails after installing `node-gyp` dependencies.

Start the app in the `dev` environment:

```bash
npm run start
```

To package apps for the local platform:

```bash
npm run package
```
