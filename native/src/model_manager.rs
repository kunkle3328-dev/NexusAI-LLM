
use crate::models::{ModelKind, model_path};
use crate::lib::Engine;
use std::sync::Arc;

pub struct ModelManager {
    current_kind: Option<ModelKind>,
    active_engine: Option<Engine>,
}

impl ModelManager {
    pub fn new() -> Self {
        Self {
            current_kind: None,
            active_engine: None,
        }
    }

    /// Load a model with RAM awareness. Unloads previous if necessary.
    pub fn load(&mut self, kind: ModelKind) -> Result<(), String> {
        if self.current_kind == Some(kind) {
            return Ok(());
        }

        // Drop current engine to free memory (RAII)
        self.active_engine = None;
        
        let path = model_path(kind);
        
        // Use a conservative thread count for initial loading
        let threads = 4; 
        
        match Engine::new(path, threads) {
            Ok(engine) => {
                self.active_engine = Some(engine);
                self.current_kind = Some(kind);
                Ok(())
            }
            Err(e) => Err(format!("Model Load Failure: {}", e))
        }
    }

    pub fn unload(&mut self) {
        self.active_engine = None;
        self.current_kind = None;
    }

    pub fn engine_mut(&mut self) -> Option<&mut Engine> {
        self.active_engine.as_mut()
    }
}
