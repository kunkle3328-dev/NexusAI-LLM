
#!/bin/bash

# NEXUS v1.0 SETUP SCRIPT
# Optimized for ARM64 Mobile Runtime

set -e

echo "🚀 Initiating Nexus Local Intelligence Stack..."

mkdir -p models
mkdir -p data/enclave

echo "📦 Downloading Primary Engine (Qwen-Coder-7B)..."
if [ ! -f "models/qwen-coder-7b.gguf" ]; then
    curl -L -o models/qwen-coder-7b.gguf \
    "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct.Q4_K_M.gguf"
fi

echo "🦀 Building Rust Inference Kernel..."
# cargo build --release

echo "📱 Ready for Nexus Execution."
