
use std::collections::HashMap;
use std::fs;

pub type ToolFn = fn(String) -> String;

pub struct ToolRegistry {
    tools: HashMap<String, ToolFn>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        let mut tools: HashMap<String, ToolFn> = HashMap::new();

        tools.insert("write_file".into(), write_file as ToolFn);
        tools.insert("read_file".into(), read_file as ToolFn);
        tools.insert("list_workspace".into(), list_workspace as ToolFn);

        Self { tools }
    }

    pub fn call(&self, name: &str, input: String) -> Option<String> {
        self.tools.get(name).map(|f| f(input))
    }
}

fn write_file(input: String) -> String {
    // Expected input format: "filename|content"
    let parts: Vec<&str> = input.splitn(2, '|').collect();
    if parts.len() != 2 {
        return "Error: Invalid format. Use 'filename|content'".into();
    }
    
    match fs::write(format!("workspace/{}", parts[0]), parts[1]) {
        Ok(_) => format!("Success: '{}' written to workspace.", parts[0]),
        Err(e) => format!("Error: Failed to write file: {}", e)
    }
}

fn read_file(filename: String) -> String {
    match fs::read_to_string(format!("workspace/{}", filename)) {
        Ok(content) => content,
        Err(e) => format!("Error: Could not read '{}': {}", filename, e)
    }
}

fn list_workspace(_: String) -> String {
    match fs::read_dir("workspace") {
        Ok(paths) => {
            let files: Vec<String> = paths
                .filter_map(|p| p.ok())
                .map(|p| p.file_name().to_string_lossy().into_owned())
                .collect();
            if files.is_empty() { "Workspace is empty.".into() }
            else { format!("Workspace files: {}", files.join(", ")) }
        }
        Err(e) => format!("Error: Could not access workspace: {}", e)
    }
}
