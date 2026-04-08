import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';

const DEVPULSE_PORT = 19876;
const POLL_INTERVAL_MS = 5000;

let statusBarItem: vscode.StatusBarItem;
let pollInterval: ReturnType<typeof setInterval> | undefined;
let lastConnected = false;

interface VscodeState {
  workspace: string | null;
  workspace_path: string | null;
  active_file: string | null;
  language: string | null;
  branch: string | null;
  dirty_files: number;
  open_tabs: number;
  is_debugging: boolean;
  terminal_active: boolean;
}

function getGitBranch(): string | null {
  try {
    const gitExtension = vscode.extensions.getExtension<any>('vscode.git')?.exports;
    if (!gitExtension) {
      return null;
    }
    const api = gitExtension.getAPI(1);
    if (!api || api.repositories.length === 0) {
      return null;
    }
    const repo = api.repositories[0];
    return repo?.state?.HEAD?.name ?? null;
  } catch {
    return null;
  }
}

function gatherState(): VscodeState {
  const editor = vscode.window.activeTextEditor;
  const workspaceFolders = vscode.workspace.workspaceFolders;

  const workspaceName = vscode.workspace.name
    ?? workspaceFolders?.[0]?.name
    ?? null;

  const workspacePath = workspaceFolders?.[0]?.uri.fsPath ?? null;

  const activeFile = editor
    ? path.basename(editor.document.fileName)
    : null;

  const language = editor?.document.languageId ?? null;

  const branch = getGitBranch();

  let dirtyFiles = 0;
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.isDirty) {
      dirtyFiles++;
    }
  }

  const openTabs = vscode.window.tabGroups.all.reduce(
    (count, group) => count + group.tabs.length,
    0
  );

  const isDebugging = vscode.debug.activeDebugSession !== undefined;
  const terminalActive = vscode.window.activeTerminal !== undefined;

  return {
    workspace: workspaceName,
    workspace_path: workspacePath,
    active_file: activeFile,
    language,
    branch,
    dirty_files: dirtyFiles,
    open_tabs: openTabs,
    is_debugging: isDebugging,
    terminal_active: terminalActive,
  };
}

function sendUpdate(state: VscodeState): void {
  const data = JSON.stringify(state);

  const options: http.RequestOptions = {
    hostname: '127.0.0.1',
    port: DEVPULSE_PORT,
    path: '/vscode-update',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
    timeout: 2000,
  };

  const req = http.request(options, (res) => {
    // Consume response data to free up memory
    res.resume();

    if (res.statusCode === 200) {
      if (!lastConnected) {
        lastConnected = true;
        updateStatusBar(true);
      }
    } else {
      if (lastConnected) {
        lastConnected = false;
        updateStatusBar(false);
      }
    }
  });

  req.on('error', () => {
    // DevPulse not running - silently fail
    if (lastConnected) {
      lastConnected = false;
      updateStatusBar(false);
    }
  });

  req.on('timeout', () => {
    req.destroy();
    if (lastConnected) {
      lastConnected = false;
      updateStatusBar(false);
    }
  });

  req.write(data);
  req.end();
}

function updateStatusBar(connected: boolean): void {
  if (connected) {
    statusBarItem.text = '$(pulse) DevPulse: Connected';
    statusBarItem.tooltip = 'DevPulse is tracking your activity';
  } else {
    statusBarItem.text = '$(pulse) DevPulse: ---';
    statusBarItem.tooltip = 'DevPulse is not connected. Make sure the app is running.';
  }
}

function tick(): void {
  const state = gatherState();
  sendUpdate(state);
}

export function activate(context: vscode.ExtensionContext): void {
  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'devpulse.showStatus';
  updateStatusBar(false);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register show status command
  const showStatusCmd = vscode.commands.registerCommand(
    'devpulse.showStatus',
    () => {
      const state = gatherState();
      const lines = [
        `Connection: ${lastConnected ? 'Connected' : 'Disconnected'}`,
        `Workspace: ${state.workspace ?? 'None'}`,
        `Active File: ${state.active_file ?? 'None'}`,
        `Language: ${state.language ?? 'N/A'}`,
        `Branch: ${state.branch ?? 'N/A'}`,
        `Dirty Files: ${state.dirty_files}`,
        `Open Tabs: ${state.open_tabs}`,
        `Debugging: ${state.is_debugging ? 'Yes' : 'No'}`,
        `Terminal Active: ${state.terminal_active ? 'Yes' : 'No'}`,
      ];
      vscode.window.showInformationMessage(
        `DevPulse Status\n${lines.join(' | ')}`
      );
    }
  );
  context.subscriptions.push(showStatusCmd);

  // Send an immediate update
  tick();

  // Start polling interval
  pollInterval = setInterval(tick, POLL_INTERVAL_MS);

  // Listen to editor/workspace events for immediate updates
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => tick())
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => tick())
  );

  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession(() => tick())
  );

  context.subscriptions.push(
    vscode.debug.onDidTerminateDebugSession(() => tick())
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTerminal(() => tick())
  );

  console.log('DevPulse Code Tracker activated');
}

export function deactivate(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
}
