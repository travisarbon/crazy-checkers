#!/usr/bin/env bash
# Generate placeholder Task 23.1 audio SFX via ffmpeg synthesis.
#
# This script produces short, mono, low-bitrate MP3s intended as baseline
# placeholders for the expanded Phase 3 audio inventory. Tones are kept
# deliberately simple: the goal is audible, royalty-free, reproducible
# audio — higher-quality assets can replace these files in place.
#
# Usage: bash scripts/generateAudio.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SFX_DIR="$REPO_ROOT/public/audio/sfx"
EV_DIR="$SFX_DIR/events"
mkdir -p "$EV_DIR"

FF="ffmpeg -y -loglevel error"
MP3_OPTS="-ac 1 -ar 44100 -b:a 64k"

# Helper: single-tone sine with envelope
# $1=file  $2=frequency  $3=duration  $4=volume (0-1)
tone() {
  local f="$1" freq="$2" dur="$3" vol="$4"
  $FF -f lavfi -i "sine=frequency=${freq}:duration=${dur}" \
    -af "volume=${vol},afade=t=in:st=0:d=0.02,afade=t=out:st=$(awk "BEGIN{print ${dur}-0.05}"):d=0.05" \
    $MP3_OPTS "$f"
}

# Helper: two-tone (note sweep via concat)
# $1=file $2=freq1 $3=freq2 $4=dur (each half)
two_tone() {
  local f="$1" a="$2" b="$3" d="$4"
  local tmp1 tmp2 list
  tmp1="$(mktemp -t tone1_XXXXXX).mp3"
  tmp2="$(mktemp -t tone2_XXXXXX).mp3"
  list="$(mktemp -t list_XXXXXX).txt"
  tone "$tmp1" "$a" "$d" 0.9
  tone "$tmp2" "$b" "$d" 0.9
  printf "file '%s'\nfile '%s'\n" "$tmp1" "$tmp2" > "$list"
  $FF -f concat -safe 0 -i "$list" -c copy "$f"
  rm -f "$tmp1" "$tmp2" "$list"
}

# Helper: noise burst with envelope
# $1=file $2=dur $3=vol $4=lowpass-hz
noise() {
  local f="$1" dur="$2" vol="$3" lp="$4"
  $FF -f lavfi -i "anoisesrc=color=white:duration=${dur}" \
    -af "lowpass=f=${lp},volume=${vol},afade=t=in:st=0:d=0.01,afade=t=out:st=$(awk "BEGIN{print ${dur}-0.1}"):d=0.1" \
    $MP3_OPTS "$f"
}

echo "Generating top-level SFX..."
two_tone "$SFX_DIR/low-time-warning.mp3" 880 880 0.15
two_tone "$SFX_DIR/unlock-chime.mp3" 523 784 0.4
tone     "$SFX_DIR/error-buzz.mp3" 110 0.3 0.6
tone     "$SFX_DIR/multi-jump.mp3" 660 0.15 0.8
two_tone "$SFX_DIR/puzzle-success.mp3" 659 988 0.3
two_tone "$SFX_DIR/puzzle-fail.mp3" 330 220 0.25

echo "Generating event SFX..."
# Impact
noise "$EV_DIR/impact-explosion.mp3" 0.5 0.9 600
noise "$EV_DIR/impact-chain.mp3" 0.7 0.8 800
tone  "$EV_DIR/impact-tick.mp3" 1200 0.3 0.6

# Shuffle
noise "$EV_DIR/shuffle-rearrange.mp3" 0.6 0.7 2000
noise "$EV_DIR/shuffle-march.mp3" 0.5 0.7 1000
tone  "$EV_DIR/shuffle-place.mp3" 220 0.4 0.8

# Magic
two_tone "$EV_DIR/magic-transform.mp3" 660 990 0.3
two_tone "$EV_DIR/magic-promote.mp3" 523 784 0.25
tone     "$EV_DIR/magic-steal.mp3" 440 0.4 0.7

# Freeze
noise "$EV_DIR/freeze-ice.mp3" 0.5 0.6 4000
tone  "$EV_DIR/freeze-decree.mp3" 165 0.6 0.8
tone  "$EV_DIR/freeze-pin.mp3" 880 0.4 0.7

# Whoosh
noise "$EV_DIR/whoosh-move.mp3" 0.3 0.6 3000
noise "$EV_DIR/whoosh-ghost.mp3" 0.5 0.5 1500
tone  "$EV_DIR/whoosh-jump.mp3" 660 0.3 0.7
noise "$EV_DIR/whoosh-rush.mp3" 0.4 0.7 2500
noise "$EV_DIR/whoosh-march.mp3" 0.5 0.6 1500
two_tone "$EV_DIR/whoosh-warp.mp3" 880 440 0.3
tone  "$EV_DIR/whoosh-bounce.mp3" 990 0.4 0.7

# Shield
tone "$EV_DIR/shield-protect.mp3" 330 0.5 0.8

# Special
two_tone "$EV_DIR/special-reverse.mp3" 784 523 0.25
tone     "$EV_DIR/special-float.mp3" 523 0.6 0.6
noise    "$EV_DIR/special-barrier.mp3" 0.4 0.7 2500
two_tone "$EV_DIR/special-crown.mp3" 784 1047 0.25
noise    "$EV_DIR/special-hot.mp3" 0.3 0.7 3500
tone     "$EV_DIR/special-card.mp3" 440 0.4 0.7
two_tone "$EV_DIR/special-toll.mp3" 1047 1397 0.15
two_tone "$EV_DIR/special-shrink.mp3" 784 392 0.3
noise    "$EV_DIR/special-ghost.mp3" 0.7 0.5 1200
tone     "$EV_DIR/special-double.mp3" 440 0.5 0.8
noise    "$EV_DIR/special-recruit.mp3" 0.4 0.6 1500

echo "Done."
