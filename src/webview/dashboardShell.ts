import * as vscode from 'vscode';

export type DashboardWebviewResources = {
  cssUri: string | undefined;
  echartsUri: string | undefined;
  scriptUri: string | undefined;
};

export function buildDashboardShellHtml(
  webview: vscode.Webview,
  options: {
    compact: boolean;
    payloadJson: string;
    bodyHtml: string;
    cssUri?: string;
    echartsUri?: string;
    scriptUri?: string;
  }
): string {
  const nonce = getNonce();
  const cssLink = options.cssUri ? `  <link rel="stylesheet" href="${options.cssUri}" />` : '';
  const echartsScript = options.echartsUri ? `  <script nonce="${nonce}" src="${options.echartsUri}"></script>` : '';
  const runtimeScript = options.scriptUri ? `  <script nonce="${nonce}" src="${options.scriptUri}"></script>` : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Code Info</title>
${cssLink}
</head>
<body class="${options.compact ? 'compact' : ''}">
  <script nonce="${nonce}" id="__codeInfoPayload" type="application/json">${options.payloadJson}</script>
  <div id="app" class="shell">${options.bodyHtml}</div>
  <pre id="error" style="display:none;white-space:pre-wrap;padding:12px;border:1px solid var(--border);border-radius:12px;"></pre>
${echartsScript}
${runtimeScript}
</body>
</html>`;
}

export function buildDashboardWebviewResources(
  webview: vscode.Webview,
  extensionUri?: vscode.Uri
): DashboardWebviewResources {
  if (!extensionUri) {
    return {
      cssUri: undefined,
      echartsUri: undefined,
      scriptUri: undefined
    };
  }

  return {
    cssUri: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview', 'macos26.css')).toString(),
    echartsUri: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vendor', 'echarts.min.js')).toString(),
    scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview', 'dashboard.js')).toString()
  };
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return value;
}
