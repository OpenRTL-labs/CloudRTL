#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SIMULATOR_DIR="$PROJECT_ROOT/simulator"

IMAGE="cloudrtl-eda:0.1"

echo "======================================"
echo "        CloudRTL RTL Simulation"
echo "======================================"

echo "[1/3] Compiling RTL..."

MSYS_NO_PATHCONV=1 docker run --rm \
    -v "$SIMULATOR_DIR:/workspace" \
    -w /workspace \
    "$IMAGE" \
    iverilog \
    -o work/counter.vvp \
    examples/counter.v \
    tests/counter_tb.v

echo "[2/3] Running simulation..."

MSYS_NO_PATHCONV=1 docker run --rm \
    -v "$SIMULATOR_DIR:/workspace" \
    -w /workspace \
    "$IMAGE" \
    vvp work/counter.vvp

echo "[3/3] Checking waveform..."

if [ -f "$SIMULATOR_DIR/work/counter.vcd" ]; then
    echo "Simulation successful."
    echo "Waveform generated:"
    echo "$SIMULATOR_DIR/work/counter.vcd"
else
    echo "ERROR: Waveform was not generated."
    exit 1
fi

echo "======================================"
echo "        Simulation Complete"
echo "======================================"