
/* 
 * NEXUS NATIVE INFERENCE KERNEL (RUST + llama.cpp)
 * Version: 3.1.0
 */

use crossbeam_channel::Sender;
use llama_cpp_rs::{LlamaModel, LlamaParams};
use anyhow::Result;

pub struct Engine {
    model: LlamaModel,
}

impl Engine {
    /// Initialize with ARM64 / NEON threading optimizations
    pub fn new(model_path: &str, threads: i32) -> Result<Self> {
        let mut params = LlamaParams::default();
        params.n_threads = threads;
        params.n_gpu_layers = 0; // CPU focus for maximum stability on low-end ARM

        let model = LlamaModel::load_from_file(model_path, params)?;
        Ok(Self { model })
    }

    /// Primary inference pipeline with real-time token emission
    pub fn generate_stream(
        &mut self,
        prompt: &str,
        token_tx: Sender<String>,
    ) -> Result<()> {
        // llama.cpp internal loop mapping
        self.model.infer(prompt, |token| {
            // Emit token to cross-thread channel for JSI bridge
            let _ = token_tx.send(token.to_string());
            true // Continue generation
        })?;
        Ok(())
    }
}
