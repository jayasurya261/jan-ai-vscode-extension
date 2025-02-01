import * as vscode from 'vscode';
import { execSync } from 'child_process';
import ollama from 'ollama';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('jan-ext.start', async () => {
        // Check if Ollama is installed
        if (!(await isOllamaInstalled())) {
            const installConfirmed = await promptInstall();
            if (!installConfirmed) {
                vscode.window.showErrorMessage("Ollama is required. Install it manually from https://ollama.ai.");
                return;
            }
        }

        // Check if the model is available, if not pull it
        if (!(await isModelAvailable('deepseek-r1:1.5b'))) {
            vscode.window.showInformationMessage("Downloading AI model, please wait...");
            try {
                await ollama.pull({
                    model: 'deepseek-r1:1.5b', // Model name
                    stream: false,               // Set to true for streaming or false as per your need
                });
                vscode.window.showInformationMessage("Model downloaded successfully.");
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to download model: ${String(error)}`);
                return;
            }
        }

        const panel = vscode.window.createWebviewPanel(
            'deepChat',
            'Jan AI Chat',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message: any) => {
            if (message.command === 'chat') {
                const userPrompt = message.text;
                try {
                    const response = await ollama.chat({
                        model: 'deepseek-r1:1.5b',
                        messages: [{ role: 'user', content: userPrompt }],
                        stream: true
                    });

                    let responseText = '';
                    for await (const chunk of response) {
                        responseText += chunk.message.content;
                        panel.webview.postMessage({
                            command: 'chatResponse',
                            text: responseText
                        });
                    }
                } catch (err) {
                    panel.webview.postMessage({
                        command: 'error',
                        text: `Error: ${String(err)}`
                    });
                }
            }
        });
    });

    context.subscriptions.push(disposable);
}

// Check if Ollama is installed (Windows: `where ollama`)
async function isOllamaInstalled(): Promise<boolean> {
    try {
        execSync('where ollama', { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
}

// Check if the model is available
async function isModelAvailable(model: string): Promise<boolean> {
    try {
        const response = await ollama.list();
        return response.models.some((m: any) => m.name === model);
    } catch (error) {
        return false;
    }
}

// Prompt the user to install Ollama manually
async function promptInstall(): Promise<boolean> {
    const selection = await vscode.window.showInformationMessage(
        "Ollama is not installed. Would you like to download it?",
        "Download", "Cancel"
    );
    if (selection === "Download") {
        vscode.env.openExternal(vscode.Uri.parse("https://ollama.ai"));
    }
    return selection === "Download";
}

// Webview UI for chat interface
function getWebviewContent(): string {
    return /*html*/`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline';">
        <title>Jan AI Chat</title>
        <style>
            :root {
                --background: #1e1e2e;
                --foreground: #cdd6f4;
                --border: #45475a;
                --button-bg: #89b4fa;
                --button-hover: #74c7ec;
                --input-bg: #313244;
                --input-border: #585b70;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background-color: var(--background);
                color: var(--foreground);
                margin: 0;
                padding: 1rem;
            }
            .chat-container {
                width: 100%;
                max-width: 600px;
                background: #2e2e3e;
                padding: 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                border: 1px solid var(--border);
            }
            h2 {
                text-align: center;
                margin-bottom: 1rem;
            }
            textarea {
                width: 100%;
                padding: 0.75rem;
                margin-bottom: 0.75rem;
                border: 1px solid var(--input-border);
                background-color: var(--input-bg);
                color: var(--foreground);
                border-radius: 5px;
                resize: vertical;
                font-size: 1rem;
            }
            button {
                width: 100%;
                padding: 0.75rem;
                background-color: var(--button-bg);
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1rem;
                transition: background 0.3s;
            }
            button:hover {
                background-color: var(--button-hover);
            }
            #response {
                margin-top: 1rem;
                white-space: pre-wrap;
                max-width: 100%;
                overflow-wrap: break-word;
            }
        </style>
    </head>
    <body>
        <div class="chat-container">
            <h2>Jan AI Chat</h2>
            <textarea id="userInput" placeholder="Ask me anything..." rows="4"></textarea>
            <button onclick="sendMessage()">Send</button>
            <div id="response"></div>
        </div>
        <script>
            const vscode = acquireVsCodeApi();

            function sendMessage() {
                const input = document.getElementById("userInput").value;
                if (input.trim() === "") return;
                
                vscode.postMessage({
                    command: 'chat',
                    text: input
                });

                document.getElementById("userInput").value = "";
            }

            window.addEventListener("message", event => {
                const message = event.data;
                if (message.command === "chatResponse") {
                    document.getElementById("response").innerText = message.text;
                } else if (message.command === "error") {
                    document.getElementById("response").innerText = "Error: " + message.text;
                }
            });
        </script>
    </body>
    </html>
    `;
}

export function deactivate() {}
