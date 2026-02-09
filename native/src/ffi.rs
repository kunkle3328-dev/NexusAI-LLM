
/* 
 * NEXUS JSI BRIDGE (FFI)
 * Purpose: Zero-latency token streaming into the React Native runtime.
 */

use std::sync::{Arc, Mutex};
use crossbeam_channel::unbounded;
use crate::Engine;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

static mut ENGINE: Option<Arc<Mutex<Engine>>> = None;

#[no_mangle]
pub extern "C" fn init_engine(model_path: *const c_char, threads: i32) {
    let path = unsafe { CStr::from_ptr(model_path) }
        .to_str()
        .unwrap();

    if let Ok(engine) = Engine::new(path, threads) {
        unsafe {
            ENGINE = Some(Arc::new(Mutex::new(engine)));
        }
    }
}

#[no_mangle]
pub extern "C" fn generate(prompt: *const c_char, callback: extern "C" fn(*const c_char)) {
    let prompt_str = unsafe { CStr::from_ptr(prompt) }
        .to_str()
        .unwrap()
        .to_string();

    let (tx, rx) = unbounded();

    // Move inference to background thread to keep UI interactive
    std::thread::spawn(move || {
        unsafe {
            if let Some(engine_arc) = &ENGINE {
                let mut engine = engine_arc.lock().unwrap();
                let _ = engine.generate_stream(&prompt_str, tx);
            }
        }
    });

    // Synchronous consumption of the channel (pumped via JSI)
    for token in rx.iter() {
        if let Ok(cstr) = CString::new(token) {
            callback(cstr.as_ptr());
        }
    }
}
