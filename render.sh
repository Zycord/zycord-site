#!/bin/sh
# Render the landing page, substituting placeholders with values from .env.
#
# The site stays static: this runs once at deploy time and writes plain HTML.
# There is no runtime, no JS reading configuration, and what nginx serves
# depends on nothing but files.
#
#   ./render.sh                      -> dist/
#   ./render.sh /var/www/zycord-front
#
# A MISSING VARIABLE IS AN ERROR, not an empty value, and so is an unstamped
# placeholder. A landing page served with href="" or with a literal
# "{{ZYCORD_RELEASES_URL}}" where the link should be is a defect nobody notices
# until somebody clicks -- and the click is what the page exists to provoke.
# Better that the deploy stops.
#
# The explorer URL used to be substituted here too. It is now written into the
# HTML, because the two hosts are not interchangeable: explorer.zycord.com is a
# placeholder page and testnet.zycord.com is the running chain, so a secret set
# to the wrong one of them served a live-looking link to "service coming online
# soon" and nothing failed. A value that must change exactly once, at mainnet
# genesis, is better as a commit than as a secret nobody re-reads.

set -eu

src=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
out=${1:-"$src/dist"}
env_file=${ZYCORD_ENV_FILE:-"$src/.env"}

if [ ! -f "$env_file" ]; then
    echo "render: $env_file does not exist. Copy .env.example to .env." >&2
    exit 1
fi

# shellcheck disable=SC1090
. "$env_file"

# Every variable the HTML expects. Adding a placeholder to index.html without
# adding its name here is how it reaches production unsubstituted.
VARS="ZYCORD_RELEASES_URL ZYCORD_SOURCE_URL"

for v in $VARS; do
    eval "value=\${$v:-}"
    if [ -z "$value" ]; then
        echo "render: $v is not set in $env_file" >&2
        exit 1
    fi
    # The example value is not a value. Without this the placeholder ships as a
    # working-looking link to a domain that cannot resolve.
    case "$value" in
        *example.invalid*)
            echo "render: $v still holds the .env.example placeholder" >&2
            exit 1
            ;;
    esac
done

mkdir -p "$out"
# --delete so a file removed from the source disappears from the destination;
# without it a renamed asset stays served under both names forever.
# .github/ is excluded because the deploy documentation describes how this
# host is locked down. It is already public on the forge, but serving it from
# the host itself hands the same map to anyone who only scans the site.
rsync -a --delete \
      --exclude '.git/' --exclude '.github/' --exclude '.gitignore' \
      --exclude '.env' --exclude '.env.example' \
      --exclude 'render.sh' --exclude 'dist/' \
      "$src/" "$out/"

for v in $VARS; do
    eval "value=\${$v}"
    # | as the delimiter because the values are URLs, full of /.
    find "$out" -type f -name '*.html' -exec \
        sed -i.bak "s|{{$v}}|$value|g" {} +
done
find "$out" -name '*.bak' -delete

# No placeholder survives. This is the check that catches a new {{FOO}} added to
# the HTML without being added to VARS.
if grep -rn '{{[A-Z_]\{1,\}}}' "$out" --include='*.html' ; then
    echo "render: the placeholders above were left unsubstituted" >&2
    exit 1
fi

echo "render: $out ready"
