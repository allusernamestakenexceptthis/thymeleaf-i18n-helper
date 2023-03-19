import * as vscode from 'vscode';

export class StateStorage {

    static async setUserSelection(context: vscode.ExtensionContext, key: string, value: any) {
        await context.workspaceState.update(key, value);
    }

    static getUserSelection(context: vscode.ExtensionContext, key: string): any {
      return context.workspaceState.get(key);
    }

}