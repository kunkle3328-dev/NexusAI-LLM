
from pydantic import BaseModel
from typing import Callable, Dict, Any, List, Optional
import os
import logging
import json

logger = logging.getLogger("NCS-Tools")

class ToolPermissions(BaseModel):
    read: bool = False
    write: bool = False
    exec: bool = False
    network: bool = False

class ToolDefinition(BaseModel):
    name: str
    description: str
    version: str = "1.1.0"
    category: str
    permissions: ToolPermissions
    rate_limit: Dict[str, int] = {"calls_per_minute": 10}
    input_schema: Dict[str, Any] = {}
    output_schema: Dict[str, Any] = {}
    side_effects: bool = True
    audit_level: str = "full"

TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {}
WORKSPACE_ROOT = os.path.abspath("runtime/workspace")

def register_tool(definition: ToolDefinition, handler: Callable):
    TOOL_REGISTRY[definition.name] = {
        "definition": definition,
        "handler": handler
    }
    logger.info(f"Registered Tool v1.1: {definition.name}")

def safe_path(path: str) -> str:
    abs_path = os.path.abspath(os.path.join(WORKSPACE_ROOT, path))
    if not abs_path.startswith(WORKSPACE_ROOT):
        raise PermissionError(f"Access denied: Path escape detected.")
    return abs_path

# --- New v1.1 Tools ---

def edit_file_patch(input_data: str) -> str:
    """Simplified patch tool. Format: 'filename|search_str|replace_str'"""
    try:
        filename, search, replace = input_data.split('|', 2)
        path = safe_path(filename.strip())
        with open(path, "r") as f:
            content = f.read()
        new_content = content.replace(search, replace)
        with open(path, "w") as f:
            f.write(new_content)
        return f"Patch applied to {filename}."
    except Exception as e:
        return f"Patch Error: {e}"

def delete_file(filename: str) -> str:
    path = safe_path(filename)
    if os.path.exists(path):
        os.remove(path)
        return f"File {filename} deleted."
    return "File not found."

def model_status(_: str) -> str:
    # This would normally query the model manager
    return "Model: Llama-3-8B | Quant: Q4_K_M | Temp: 42C"

# Initialize Registry v1.1
register_tool(
    ToolDefinition(
        name="edit_file_patch",
        description="Diff-based patch for files",
        category="filesystem",
        permissions=ToolPermissions(read=True, write=True)
    ),
    edit_file_patch
)

register_tool(
    ToolDefinition(
        name="delete_file",
        description="Controlled file deletion",
        category="filesystem",
        permissions=ToolPermissions(read=True, write=True)
    ),
    delete_file
)

register_tool(
    ToolDefinition(
        name="model_status",
        description="Query active model health",
        category="system",
        permissions=ToolPermissions(read=True),
        side_effects=False
    ),
    model_status
)

async def execute_tool(name: str, input_data: str, user_perms: Dict[str, bool]) -> str:
    if name not in TOOL_REGISTRY:
        return f"Error: Tool '{name}' not found."
    
    tool = TOOL_REGISTRY[name]
    required = tool["definition"].permissions
    
    # Permission check
    for p, val in required.dict().items():
        if val and not user_perms.get(p, False):
            return f"Permission Denied: Missing '{p}' capability."
            
    try:
        return str(tool["handler"](input_data))
    except Exception as e:
        return f"Tool Failure: {e}"
