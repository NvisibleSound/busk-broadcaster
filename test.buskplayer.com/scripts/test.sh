#!/bin/bash
#
# Icecast Broadcast Test Script
# Generates a test tone, broadcasts to Icecast, and verifies audio is received
#

set -e

# Configuration
ICECAST_HOST="${ICECAST_HOST:-test.buskplayer.com}"
ICECAST_PORT="${ICECAST_PORT:-8000}"
ICECAST_MOUNT="${ICECAST_MOUNT:-/ether}"
ICECAST_PASSWORD="${ICECAST_PASSWORD:-EtherIsBetter}"
BROADCAST_DURATION="${BROADCAST_DURATION:-10}"
LISTEN_DURATION="${LISTEN_DURATION:-5}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  Icecast Broadcast Test"
echo "=========================================="
echo ""
echo "Server: ${ICECAST_HOST}:${ICECAST_PORT}${ICECAST_MOUNT}"
echo "Broadcast duration: ${BROADCAST_DURATION}s"
echo ""

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}Error: ffmpeg is not installed${NC}"
    exit 1
fi

# Create temp directory for test files
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Step 1: Generate a test tone (440Hz sine wave)
echo -e "${YELLOW}[1/4] Generating test tone...${NC}"
ffmpeg -f lavfi -i "sine=frequency=440:duration=${BROADCAST_DURATION}" \
    -acodec libmp3lame -ab 128k -ar 48000 \
    -y "${TMPDIR}/test_tone.mp3" 2>/dev/null

if [ ! -f "${TMPDIR}/test_tone.mp3" ]; then
    echo -e "${RED}Error: Failed to generate test tone${NC}"
    exit 1
fi
echo -e "${GREEN}   Test tone generated${NC}"

# Step 2: Start broadcasting in background
echo -e "${YELLOW}[2/4] Broadcasting test tone to Icecast...${NC}"
ffmpeg -re -i "${TMPDIR}/test_tone.mp3" \
    -acodec libmp3lame -ab 128k -ar 48000 \
    -content_type audio/mpeg \
    -f mp3 "icecast://source:${ICECAST_PASSWORD}@${ICECAST_HOST}:${ICECAST_PORT}${ICECAST_MOUNT}" \
    2>"${TMPDIR}/broadcast.log" &
BROADCAST_PID=$!

# Wait for stream to initialize
sleep 3

# Check if broadcast is still running
if ! kill -0 $BROADCAST_PID 2>/dev/null; then
    echo -e "${RED}Error: Broadcast failed to start${NC}"
    cat "${TMPDIR}/broadcast.log"
    exit 1
fi
echo -e "${GREEN}   Broadcasting...${NC}"

# Step 3: Listen and capture audio
echo -e "${YELLOW}[3/4] Capturing audio from stream...${NC}"
LISTEN_URL="http://${ICECAST_HOST}:${ICECAST_PORT}${ICECAST_MOUNT}"

# Try to capture audio from the stream
timeout ${LISTEN_DURATION} ffmpeg -i "${LISTEN_URL}" \
    -t ${LISTEN_DURATION} \
    -y "${TMPDIR}/captured.mp3" 2>"${TMPDIR}/listen.log" || true

# Stop broadcast
kill $BROADCAST_PID 2>/dev/null || true
wait $BROADCAST_PID 2>/dev/null || true

# Step 4: Verify captured audio
echo -e "${YELLOW}[4/4] Verifying captured audio...${NC}"

if [ -f "${TMPDIR}/captured.mp3" ]; then
    # Check file size (should be > 0)
    FILE_SIZE=$(stat -f%z "${TMPDIR}/captured.mp3" 2>/dev/null || stat -c%s "${TMPDIR}/captured.mp3" 2>/dev/null || echo "0")

    if [ "$FILE_SIZE" -gt 1000 ]; then
        # Analyze audio to check for actual content
        AUDIO_INFO=$(ffprobe -v error -show_entries format=duration,bit_rate -of csv=p=0 "${TMPDIR}/captured.mp3" 2>/dev/null || echo "")

        if [ -n "$AUDIO_INFO" ]; then
            echo ""
            echo -e "${GREEN}=========================================="
            echo "  TEST PASSED"
            echo "==========================================${NC}"
            echo ""
            echo "Captured audio details:"
            echo "  File size: ${FILE_SIZE} bytes"
            echo "  Audio info: ${AUDIO_INFO}"
            echo ""
            echo "The Icecast server is working correctly!"
            echo ""
            exit 0
        fi
    fi
fi

# If we get here, something went wrong
echo ""
echo -e "${RED}=========================================="
echo "  TEST FAILED"
echo "==========================================${NC}"
echo ""
echo "Could not verify audio was received."
echo ""
echo "Broadcast log:"
cat "${TMPDIR}/broadcast.log" 2>/dev/null || echo "(no log)"
echo ""
echo "Listen log:"
cat "${TMPDIR}/listen.log" 2>/dev/null || echo "(no log)"
echo ""
exit 1
