
pub struct Plan {
    pub steps: Vec<String>,
}

pub fn plan(prompt: &str) -> Plan {
    let steps = vec![
        "Understand the request".into(),
        "Break into subtasks".into(),
        "Execute each subtask".into(),
        "Produce final response".into(),
    ];
    Plan { steps }
}
