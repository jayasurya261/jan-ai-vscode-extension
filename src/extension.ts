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

        // Ask user to choose the model
        const model = await vscode.window.showQuickPick(['deepseek-r1:1.5b', 'deepseek-r1:7b'], {
            placeHolder: 'Select the AI model to use',
        });

        if (!model) {
            vscode.window.showErrorMessage("No model selected. Please restart and select a model.");
            return;
        }

        // Check if the selected model is available
        if (!(await isModelAvailable(model))) {
            const downloadConfirmed = await promptModelDownload(model);
            if (!downloadConfirmed) {
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
                        model: model,
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
        "Ollama is not installed. Would you like to visit the Instruction website?",
        "Visit Website", "Cancel"
    );
    if (selection === "Visit Website") {
        vscode.env.openExternal(vscode.Uri.parse("https://jan-ai-extension.vercel.app/"));
    }
    return selection === "Visit Website";
}

// Prompt the user to download the model manually
async function promptModelDownload(model: string): Promise<boolean> {
    const selection = await vscode.window.showInformationMessage(
        `The model "${model}" is not available. Would you like to download it manually?`,
        "Visit Model Page", "Cancel"
    );
    if (selection === "Visit Model Page") {
        vscode.env.openExternal(vscode.Uri.parse("https://jan-ai-extension.vercel.app/"));
    }
    return selection === "Visit Model Page";
}

// Webview UI for chat interface
function getWebviewContent(): string {
    return /*html*/`
    <!DOCTYPE html>
    <html lang="en">
    <head>
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
                --input-focus: #89b4fa;
                --loading-color: #89b4fa;
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
                text-align: center;
            }
            h2 {
                margin-bottom: 1rem;
            }
            .top-link {
                margin-bottom: 1rem;
            }
            .top-link a {
                text-decoration: none;
                background-color: var(--button-bg);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 5px;
                font-size: 1rem;
                transition: background 0.3s;
            }
            .top-link a:hover {
                background-color: var(--button-hover);
            }
            textarea {
                width: 100%;
                padding: 8px;
                margin-bottom: 0.75rem;
                border: 1px solid var(--input-border);
                background-color: var(--input-bg);
                color: var(--foreground);
                border-radius: 5px;
                resize: vertical;
                font-size: 1rem;
                transition: border-color 0.3s, box-shadow 0.3s;
            }
            textarea:focus {
                border-color: var(--input-focus);
                box-shadow: 0 0 0 2px rgba(137, 180, 250, 0.2);
                outline: none;
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
            .loading {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-top: 1rem;
            }
        </style>
    </head>
    <body>
        <div class="chat-container">
            <div class="top-link">
                <a href="https://jan-ai-extension.vercel.app/" target="_blank">Visit Official Page</a>
            </div>
            <h2>Jan AI Chat</h2>
            <textarea id="userInput" placeholder="Ask me anything..." rows="4"></textarea>
            <button onclick="sendMessage()">Send</button>
            <div id="response"></div>
            <div class="loading" id="loading" style="display: none;">
                <span>Loading...</span>
            </div>
        </div>
        <script>
            const vscode = acquireVsCodeApi();

            function sendMessage() {
                const input = document.getElementById("userInput").value;
                if (input.trim() === "") return;
                vscode.postMessage({ command: 'chat', text: input });
                document.getElementById("userInput").value = "";
            }

            document.getElementById("userInput").addEventListener("keypress", function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    sendMessage();
                }
            });
        </script>
    </body>
    </html>
    `;
}

export function deactivate() {}
