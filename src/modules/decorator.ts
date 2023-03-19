import * as vscode from 'vscode';
import { getIndexerManager, getLanguageManager } from '../extension';


export class DecoratorManager {

    private decorationType : vscode.TextEditorDecorationType;
    private prevMatches : Array<string> = [];

    constructor(context: vscode.ExtensionContext) {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            before: {
                contentText: '',
                margin: '0 0 0 0',
                color: 'rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(255, 255, 255, 1)',
            },
            textDecoration: 'none; display:none;'
        });

        this.decorateOverlay();

        const debouncedDecorateOverlay = this.debounce(this.decorateOverlay.bind(this), 300);

        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(this.decorateOverlay));

        // Add an event listener for when the active text editor selection changes
        context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(debouncedDecorateOverlay));

        // Add an event listener for when the visible ranges change (e.g., when scrolling)
        context.subscriptions.push(vscode.window.onDidChangeTextEditorVisibleRanges(debouncedDecorateOverlay));

        // Add an event listener for when current language changes
        getLanguageManager().addObserver(() => {this.decorateOverlay();});
    }

    debounce(func: (...args: any[]) => void, wait: number) {
        let timeout: NodeJS.Timeout | null;

        return (...args: any[]) => {
            const later = () => {
                timeout = null;
                func(...args);
            };

            if (timeout !== null) {
                clearTimeout(timeout);
            }

            timeout = setTimeout(later, wait);
        };
    }

    decorateOverlay(){
        const currentLanguage = getLanguageManager().getCurrentLanguage();
        if (currentLanguage === "Off") {
            this.removeDecorations();
            this.prevMatches = [];
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        let curMatches : Array<string> = [];
        let pattern = /#{(.*)}/g;
        let matches : vscode.DecorationOptions[] = [];
        let text = editor.document.getText();
        let match;

        const selection = editor.selection;
        
        
        while (match = pattern.exec(text)) {
            let startPos = editor.document.positionAt(match.index);
            let endPos = editor.document.positionAt(match.index + match[0].length);
            let range = new vscode.Range(startPos, endPos);
            if (range.contains(selection.start)) {
                continue;
            }

            // Look up the translation for the current match
            let translation = this.lookupTranslation(match[1], currentLanguage);
            if (!translation) {
                continue;
            }
            
            // Add the translation to the list of decorations
            let decoration: vscode.DecorationOptions = 
                            {
                                range,
                                renderOptions: {
                                    before: {
                                        contentText: translation
                                    }
                                }
                            };


            // Add to decoration range and render object
            matches.push(decoration);

            // Add to current matches
            curMatches.push(match[1]+translation);

        }
        if (this.prevMatches && this.prevMatches.length === curMatches.length && this.prevMatches.every((v,i)=> v === curMatches[i])) {
            return;
        }else if (this.decorationType) {
            //decorationType.dispose();
            //clear decorations
            this.removeDecorations();
        }
        this.prevMatches = curMatches;

        
        editor.setDecorations(this.decorationType, matches);
    }


    lookupTranslation(key: string, currentLanguage: string) {
        // Code to look up the translation for the given key from the i18n files
        // and return the translation.
        const messages = getIndexerManager().getMessages();
        if (currentLanguage === 'D') {
            currentLanguage = "";
        }
        for (let fileName in messages) {
            const language = getIndexerManager().getLangFromFile(fileName);
            // check if currentLanguage is in the file name
            if (currentLanguage !== language) {
                continue;
            }
            if (messages[fileName][key]) {
                return messages[fileName][key];
            }
        }
        
    }

    removeDecorations(){
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        editor.setDecorations(this.decorationType, []);
    }

    dispose() {
        //do nothing
    }
}