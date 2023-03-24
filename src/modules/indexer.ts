import * as fs from 'fs';
import * as vscode from 'vscode';
import path = require('path');
import { extensionID } from './identifier';
import { getLanguageManager } from '../extension';

export class IndexerManager {

    private messages: { [key: string]: {[key: string] : string} } = {};
    
    private watcher: vscode.FileSystemWatcher | undefined;
    private configWatcher: vscode.Disposable  | undefined;

    private context: vscode.ExtensionContext;
    private cachedFileLanguage: { [key: string]: string } = {};

    private oldDirectory: string = "";

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async activate() {

        this.startFreshScan();
        this.watchConfig();

        if (!this.watcher) {
            this.watcher = vscode.workspace.createFileSystemWatcher('**/*.properties');
        }

        this.context.subscriptions.push(
            this.watcher,
            this.watcher.onDidChange((e) => {
                this.updateMessage(e.fsPath);
            }),
            this.watcher.onDidCreate((e) => {
                this.updateMessage(e.fsPath);
            }),
            this.watcher.onDidDelete((e) => {
                this.removeMessage(e.fsPath);
            })
        );
    }

    //watch config changes
    watchConfig() {
        this.configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(`${extensionID}.exclude`) ||
                e.affectsConfiguration(`${extensionID}.folder`) ||
                e.affectsConfiguration('files.exclude')
            ) {
                this.startFreshScan();
            }
        });

        this.context.subscriptions.push(this.configWatcher);
    }

    getConfigFolder(){
        const workspaceRoot = vscode.workspace.workspaceFolders![0]!.uri.fsPath;
        if (!workspaceRoot) {
            return "";
        }

        let messagesFolder = vscode.workspace.getConfiguration().get<string>(extensionID+'.folder');
        
        if (!messagesFolder) {
            messagesFolder = "";
        }

        messagesFolder = path.normalize(messagesFolder.trim());

        if (!path.isAbsolute(messagesFolder)) {
            messagesFolder = path.join(workspaceRoot, messagesFolder);
        }
        if (!fs.existsSync(messagesFolder)) {
            return "";
        }
        return messagesFolder;
    }

    startFreshScan() {
        //delete messages
        this.messages = {};

        const directory = this.getConfigFolder();
        if (!directory) {
            return;
        }
        if (!this.oldDirectory || this.oldDirectory !== directory) {
            if (this.watcher) {
                this.watcher.dispose();
            }
            this.watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(directory, '**/*.properties')
            );

            this.oldDirectory = directory;
        }
        this.scanDirectory(directory);
    }

    scanDirectory(directory: string) {
        const filesExclude = vscode.workspace.getConfiguration().get<Record<string, boolean>>('files.exclude') || {};
        const i18nExclude = vscode.workspace.getConfiguration().get<Record<string, boolean>>(extensionID+'.exclude') || {};
        
        const exclude = {...filesExclude, ...i18nExclude};

        const files = fs.readdirSync(directory);
        for (const file of files) {
            const filePath = path.join(directory, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                if (!exclude || !exclude[file]) {
                    this.scanDirectory(filePath);
                }
            } else if (file.endsWith('.properties')) {
                this.updateMessage(filePath);
            }
        }
    }

    addMessage(fileName: string, key: string, value: string) {
        if (!this.messages[fileName]) {
            this.messages[fileName] = {};
        }
        this.messages[fileName][key] = value;
    }

    updateMessage(uri: string){
        const fileName = path.basename(uri);
        //get string after underscore from file
        const language = this.getLangFromFile(fileName);
        if (language){
            getLanguageManager().addALanguage(language);
        }
        if (this.messages[uri]){
            delete this.messages[uri];
        }
        if (this.checkIfFilenameIsExcluded(fileName, uri)){
            return;
        }
        
        // read file and update messages
        const data = fs.readFileSync(uri, 'utf-8');
        const lines = data.split(/\r?\n/);
        for (const line of lines) {
            if (line.startsWith('#')) {
                continue;
            }
            const index = line.indexOf('=');
            if (index === -1) {
                continue;
            }
            const key = line.substring(0, index).trim();
            const value = line.substring(index + 1).trim();
            if (!this.messages[uri]) {
                this.messages[uri] = {};
            }
            this.messages[uri][key] = value;
        }
    }

    removeMessage(uri: string){
        const fileName = path.basename(uri);
        if (this.messages[uri]){
            //get string after underscore from file
            const language = this.getLangFromFile(fileName);
            delete this.messages[uri];
            if (language){
                this.removeLanguageIfEmpty(language);
            }
        }
    }

    /*
    * Check if language no longer has any messages
    */
    removeLanguageIfEmpty(language: string){
        for (const message in this.messages) {
            if (message === language){
                return;
            }
        }
        getLanguageManager().removeALanguage(language);
    }

    checkIfFilenameIsExcluded(filename: string, uri: string) {
        const messagesFolder = this.getConfigFolder();
        if (!messagesFolder) {
            return true;
        }
        if (!uri.startsWith(messagesFolder)) {
            return true;
        }

        const excludedFoldersSettings = vscode.workspace.getConfiguration().get<string[]>(extensionID+'.exclude');
        if (!excludedFoldersSettings){
            return false;
        }
        
        for (const pattern of excludedFoldersSettings) {
            if (filename.match(pattern) || uri.match(pattern)) {
                return true;
            }
        }
        return false;
    }

    getLangFromFile(fileName: string) {
        if (this.cachedFileLanguage[fileName]) {
            return this.cachedFileLanguage[fileName];
        }
        let lang = '';
        const parts = fileName.split('_');

        if (parts.length > 1) {
            lang = parts[1].split('.')[0];
        }
        this.cachedFileLanguage[fileName] = lang;
        return lang;
    }

    /*
    * Gets the language code from the file name adjusted for comparison e.g. none = D
    */
    getLangFromFileForCheck(fileName: string) {
        const lang = this.getLangFromFile(fileName);
        if (lang === '') {
            return 'D';
        }
        return lang;
    }

    getMessages() {
        return this.messages;
    }

    dispose() {
        this.watcher?.dispose();
    }
}