#Iris Devbox Tools

Iris is a simple devbox, hosted locally on the client using v86, providing a minimal, resource use centric open devbox for LLM’s to code in. The following documentation details the features of the Iris devbox, and how to properly use it for the best response.

# COMMAND TOOL (command-tool)
Use the Command tool for…
Entering commands into the terminal
Moving between directories
Sending payloads to the devbox console
View and log responses in the "response" parameter
This tool is a key facit in your tool kit, allowing you to send commands, and for them to automatically be entered in tty:s0

## Sent JSON

```json
{
 "vm-tool": "command-tool",
 "reasoning": “LLM REASONING GOSE HERE FOR USER”,
 "command-sent": “EXAMPLE COMMAND HERE”
}
```

## Response JSON

```json
{
 "request-sucess": true,
 "vm-tool": "command-tool",
 "response": "EXAMPLE OUTPUT HERE"
}
```

# LIST FILES TOOL (list-files)
Use the List Files tool for…
Listing files and folders in a directory

This tool allows you to quickly list and find files in the devbox, especially in complex filesystems, or in pulled github repos

## Sent JSON

```json
{
 "vm-tool": "list-files",
 "reasoning": “LLM REASONING GOSE HERE FOR USER”
}
```

## Response JSON

```json
{
 "request-sucess": true,
 "vm-tool": "list-files",
 "response": “EXAMPLE FILES HERE”
}
```

# WRITE TEXT TOOL (send-text)
Use the Write Text tool for..
Writing Code / Text using Nano and other tools
When using Enter at the end like a command is not necessary

This is a key foundational tool in your toolkit

## Sent JSON

```json
{
 "vm-tool": "send-text",
 "text": "EXAMPLE TEXT HERE",
 "reasoning": “LLM REASONING GOSE HERE FOR USER”
}
```

## Response JSON

```json
{
 "request-sucess": true,
 "vm-tool": "send-text",
 "text": "EXAMPLE TEXT HERE"
}
```

# SEND KEYPRESS TOOL (send-keypress)
Use the Send Keypress tool for…
Keybinds and shortcuts
Exiting menus
Iterating with the vm in ways text can not

This tool is crucial for using many GNU tools, which may require keybinds to execute certain functions

## Sent JSON

```json
{
 "vm-tool": "send-keypress",
 "key": "CMD, X", //can also send keyboard shortcuts by doing things such as CMD, X with comma
 "reasoning": “LLM REASONING GOSE HERE FOR USER”
}
```

## Response JSON

```json 
{
 "request-sucess": true,
 "vm-tool": "send-keypress",
 "sent-keypress": "CMD, X"
}
``` 

# SCREEN VIEWER TOOL (view-console)
Use the Screen Viewer tool for…
When you need to review or check enter text
Read the terminal or past commands
Check what the current console says
Read files

This tool allows you to view all text in the console, which is key to review files, and gain contexts for projects

## Sent JSON

```json
{
 "vm-tool": "veiw-console",
 "reasoning": “LLM REASONING GOSE HERE FOR USER”
}
``` 

## Response JSON

```json
{
 "request-sucess": true,
 "vm-tool": "veiw-console",
 "Console-contents": "EXAMPLE OF CONSOLES CONTENTS”
}
``` 

# Instructions For Usage

If the tool can not be executed, it will return "request-sucess": false
And a new JSON Parameter "error-thrown" will appear as such. "error-thrown": "ERROR HERE". If this occurs, retry the tool 5 times, and if the same error returns, send the current files to the user, and explain the error to the user, and remind the user to start a new session to continue, or depending on the error, check their internet connection.

Policy for JSON Querying:
Always ensure JSON is valid and properly formatted.
Never omit required fields for a tool.
Always include reasoning before executing a tool call.
Prefer minimal commands with clear intent.
Treat console output as authoritative for debugging and next actions.

