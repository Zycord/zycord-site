# zycord-site

The Zycord landing page and documentation, served at
[zycord.com](https://zycord.com).

The site is static. `render.sh` runs once at deploy time and writes plain
HTML; nothing is generated in the browser, and what nginx serves depends on
nothing but files on disk.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | The landing page |
| `docs/` | Documentation: install, mining, running a node, protocol, architecture, wallet, verification, testnet, FAQ, glossary, whitepaper |
| `download/` | Release downloads page |
| `faucet/` | Testnet faucet page |
| `assets/`, `css/`, `js/` | Static assets |
| `render.sh` | Substitutes placeholders and writes the output tree |

## Building locally

Two values are not committed, because each environment points at a different
place. Copy the example file and fill them in:

```sh
cp .env.example .env
$EDITOR .env
./render.sh dist
```

`render.sh` writes to `dist/` by default, or to a directory given as its first
argument. Serve that directory with any static file server to preview it.

A missing variable is an error rather than an empty value, and so is a
placeholder that survives into the output. A page served with `href=""` or a
literal `{{ZYCORD_RELEASES_URL}}` is a defect nobody notices until somebody
clicks, and the click is what the page exists to provoke. The render stops
instead.

The explorer URL is deliberately not one of these values. It is written into
the HTML directly, because `explorer.zycord.com` and `testnet.zycord.com` are
not interchangeable and a misconfigured secret would serve a live-looking link
to the wrong one without anything failing.

## Deployment

A push to `main` renders the site and publishes it to the production node over
rsync. There is no `pull_request` trigger: a workflow that runs on pull
requests while holding deploy credentials can be reached by anyone who opens
one.

The workflow needs five repository secrets.

| Secret | Purpose |
| --- | --- |
| `ZYCORD_RELEASES_URL` | `https://github.com/Zycord/zycord-node/releases/latest`, no trailing slash |
| `ZYCORD_SOURCE_URL` | `https://github.com/Zycord/zycord-node`, no trailing slash |
| `DEPLOY_HOST` | The production node |
| `DEPLOY_SSH_KEY` | Private key for the rsync-restricted deploy account |
| `DEPLOY_KNOWN_HOSTS` | Pinned host key for that node |

Secrets are read when a run starts, so a run queued before a secret is set
fails on the missing value and needs to be re-run rather than re-pushed.

Deploys are serialized through a concurrency group. Two overlapping
`rsync --delete` runs against the same directory can interleave and leave the
site in a mixed state, so a running deploy is never cancelled by the next one.

The deploy account is restricted to rsync and cannot open a shell. Host key
checking is strict against the pinned `known_hosts`, so the credential is never
offered to whatever host happens to answer. The runner's copy of the key is
removed after the job, including when it fails.
