// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { LanguageManager } from './modules/language';
import { IndexerManager } from './modules/indexer';
import { DecoratorManager } from './modules/decorator';
import { ContextManager } from "./modules/context";

let languageManager: LanguageManager;
let indexerManager: IndexerManager;
let decoratorManager: DecoratorManager;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    // should change activation to "workspaceContains:**/.properties"
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('"thymeleaf-i18n-helper" activated!');

    languageManager = new LanguageManager(context);
    indexerManager = new IndexerManager(context);
    await indexerManager.activate();

    decoratorManager = new DecoratorManager(context);
    const contextManager = new ContextManager(context);
}

// This method is called when your extension is deactivated
export function deactivate() {
    decoratorManager.dispose();
    indexerManager.dispose();
    console.log('"thymeleaf-i18n-helper" deactivated!');
}

export function getIndexerManager(): IndexerManager {
    return indexerManager;
}

export function getLanguageManager(): LanguageManager {
    return languageManager;
}

export function getDecoratorManager(): DecoratorManager {
    return decoratorManager;
}