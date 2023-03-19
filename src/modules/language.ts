import * as vscode from 'vscode';
import { extensionID } from './identifier';
import * as flags from '../data/langFlags.json';
import { StateStorage } from './statestorage';

export class LanguageManager {
    private _currentLanguage: string = "D";
    private languages: {label: string, value: string}[] = [];
    private languageStatusBarItem: vscode.StatusBarItem;
    private observers: Array<(language: string) => void> = [];
    private langFlags: { [key: string]: string } = {};
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        //load lang flags
        this.langFlags = flags as { [key: string]: string };
        this.context = context;
        

        this.languageStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right
        );
        this._currentLanguage = this.retrieveUserSelectedLanguage();
        this.languageStatusBarItem.text = this._currentLanguage;
        this.languageStatusBarItem.tooltip = 'Select Language';

        const showLanguageOptionsCommand = vscode.commands.registerCommand(
            extensionID + '.showLanguageOptions',
            this.showLanguageOptions.bind(this)
        );

        this.languageStatusBarItem.command = extensionID + '.showLanguageOptions';
        this.languageStatusBarItem.show();

        this.context.subscriptions.push(showLanguageOptionsCommand, this.languageStatusBarItem);
    }

    private showLanguageOptions() {
        let languageOptions = [
                {'label':"🚫 Off", 'value': "Off"}, 
                {'label':"🌐 Default", 'value': "D"}
        ];

        // Merge the languages with the default options
        languageOptions = languageOptions.concat(this.languages);

        const curLangIndex = languageOptions.findIndex((lang) => lang.value === this._currentLanguage);

        if (curLangIndex > -1) {
            languageOptions[curLangIndex].label = languageOptions[curLangIndex].label + " ✅ (Current)";
        }

        vscode.window.showQuickPick(languageOptions)
            .then((language) => {
                if (language) {
                    this.setCurrentLanguage(language.value);
                }
            });
    }

    private retrieveUserSelectedLanguage() {
        let language = StateStorage.getUserSelection(this.context ,'curlanguage');
        if (!language) {
            language = "D";
        }
        return language;
    }

    addALanguage(language: string) {
        //Check if language is already in the list by value of this.languages
        const index = this.languages.findIndex((lang) => lang.value === language);
        if (index === -1) {
            let flag: string = this.getFlag(language);
            this.languages.push({
                label: ((flag)?flag + " " : "") + language.toUpperCase(),
                value: language
            });
        }
    }

    removeALanguage(language: string) {
        const index = this.languages.findIndex((lang) => lang.value === language);
        if (index > -1) {
            this.languages.splice(index, 1);
            if (this._currentLanguage === language) {
                this.setCurrentLanguage("D");
            }
        }
    }

    // Map language code to emoji flag
    private getFlag(language: string) {
        return this.langFlags[language] || '';
    }

    async setCurrentLanguage(language: string) {
        this._currentLanguage = language;
        this.languageStatusBarItem.text = this._currentLanguage;
        await StateStorage.setUserSelection(this.context ,'curlanguage', language);
        vscode.window.setStatusBarMessage(`Language set to ${language}`, 2000);
        this.observers.forEach((observer) => {
            observer(language);
        });
    }

    getCurrentLanguage() {
        return this._currentLanguage;
    }

    addObserver(observer: (language: string) => void) {
        this.observers.push(observer);
    }

    removeObserver(observer: (language: string) => void) {
        const index = this.observers.indexOf(observer);
        if (index > -1) {
            this.observers.splice(index, 1);
        }
    }

    /*
    * Gets the current language code adjusted for comparison e.g. Off = D
    */
    getCurrentLanguageForCheck() {
        if (this._currentLanguage === "Off") {
            return "D";
        }
        return this._currentLanguage;
    }
}