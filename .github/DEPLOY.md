# Deployment

`.github/workflows/deploy.yml` renders the landing page and publishes it to the
production node on every push to `main`, and on manual dispatch.

## Required secrets

Set these under *Settings → Secrets and variables → Actions*. None of them belong
in the repository.

| Secret | Contents |
|---|---|
| `ZYCORD_RELEASES_URL` | Where the download buttons point: the releases page, not one archive. A release publishes two tiers across several platforms and the file names carry the version, so a link to a single file rots at the next tag. No trailing slash. |
| `ZYCORD_SOURCE_URL` | Where "View Source Code" points: the repository. No trailing slash. |
| `DEPLOY_SSH_KEY` | Private half of the CI-only SSH key, OpenSSH format, including the header and trailer lines. |
| `DEPLOY_HOST` | Hostname or address of the production node. |
| `DEPLOY_KNOWN_HOSTS` | The node's `known_hosts` line, used to pin its host key. |

The explorer URL is deliberately **not** a secret. `explorer.zycord.com` and
`testnet.zycord.com` are different hosts serving different things -- the first is
a placeholder page until mainnet, the second is the running chain -- so a secret
pointing at the wrong one produced a link that resolved, rendered, and told the
visitor the service was coming online soon. Nothing failed, and nothing could:
`render.sh` can check that a value is *set*, never that it is the right host. It
is written into the HTML instead, where changing it is a reviewable commit. It
changes exactly once, at mainnet genesis.

## How the deploy credential is constrained

The CI key is **not** an administrative account. On the server it belongs to an
unprivileged `deploy` user with no sudo rights, and its `authorized_keys` entry
carries a forced command:

    command="/usr/bin/rrsync -wo /var/www/<site>",restrict <key>

The consequences, each verified against the live host:

- The key cannot open a shell or run any command other than rsync.
- It cannot write outside the site directory. Absolute paths and `..` are both
  rejected — an absolute path is confined to the restricted root rather than
  escaping it.
- `-wo` makes it write-only: it cannot read the directory back.
- `restrict` disables port forwarding, agent forwarding, X11 and pty allocation.

If this key leaks, the worst case is that someone overwrites a static landing
page. It does not grant access to the node.

**Do not replace this key with an administrative one.** The account used for
server administration has passwordless sudo; putting it in CI would hand root on
production to anything that can trigger a workflow run.

## Verification

Because the key is write-only, the workflow cannot read the site back to confirm
what landed. That is a deliberate trade: a smaller blast radius in exchange for
no read-back check. `render.sh` fails loudly on an unsubstituted placeholder or a
missing variable, and `rsync` fails loudly on a transfer error, so a broken
deploy surfaces as a failed job rather than a silently wrong site.

## Rotating the CI key

1. Generate a new keypair. Always pass `-C` explicitly — `ssh-keygen` otherwise
   writes `user@hostname` into the public key, which ends up in the server's
   `authorized_keys`.
2. Replace the forced-command line in the `deploy` user's `authorized_keys`.
3. Update the `DEPLOY_SSH_KEY` secret.
4. Confirm the old key no longer authenticates.
