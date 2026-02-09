
# Nexus AI Mobile Ready-to-Build

## Prerequisites
1. Android Studio with NDK support.
2. Chaquopy plugin installed in Gradle.
3. Physical ARM64 Android device (min SDK 26).

## Deployment
1. Download `llama3-8b-instruct-q4_K_M.gguf` and place it in `app/src/main/python/binaries/`.
2. Place `whisper.onnx` and `piper.onnx` in the same directory.
3. Sync Gradle and Run.

## Architecture
- **Inference**: llama-cpp-python running on mobile CPU.
- **Voice**: Whisper (STT) and Piper (TTS) for natural interaction.
- **Privacy**: 100% Offline. All prompts are device-bound.
