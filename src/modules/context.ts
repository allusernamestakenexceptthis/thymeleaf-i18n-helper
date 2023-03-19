import { FilesaveManager } from './filesave';
import * as vscode from 'vscode';
import { extensionID } from './identifier';
import { getDecoratorManager, getIndexerManager, getLanguageManager } from '../extension';
import path = require('path');


export class ContextManager {

    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        const processSelectionCommand = vscode.commands.registerCommand(extensionID + '.processSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
              return;
            }
        
            const document = editor.document;
            let selection = editor.selection;
            let text: string = "";

            let typeOfSelection = "";
        
            if (selection.isEmpty) {
              // If there is no selection, try to regex capture text between HTML tags.
              const lineText = document.lineAt(selection.start.line).text;
              const cursorPosition = selection.start.character;

                // Capture text within a tag
                const tagRegex = /<[^>]+>(.*?)<\/[^>]+>/g;
                let tagMatch;
                while ((tagMatch = tagRegex.exec(lineText)) !== null) {
                    if (cursorPosition >= tagMatch.index && cursorPosition <= tagRegex.lastIndex) {
                        text = tagMatch[1];
                        typeOfSelection = "tag";
                        console.log("Text within tag:", tagMatch[1]);
                        break;
                    }
                }

                // Capture text within an attribute value
                const attributeRegex = /(\S+)=["']([^"']+)["']/g;
                let attributeMatch;
                while ((attributeMatch = attributeRegex.exec(lineText)) !== null) {
                    const attributeValueStart = attributeMatch.index + attributeMatch[1].length + 2;
                    const attributeValueEnd = attributeValueStart + attributeMatch[2].length;

                    if (cursorPosition >= attributeValueStart && cursorPosition <= attributeValueEnd) {
                        text = attributeMatch[2];
                        typeOfSelection = "attribute";
                        console.log("Text within attribute value:", attributeMatch[2]);
                        break;
                    }
                }
            
                if (!text) {
                    vscode.window.showErrorMessage('No valid text or variable found, try selecting some text or a variable');
                    return;
                }
            } else {
              // If there is a selection, grab the selected text.
              text = document.getText(selection);
            }

            let firstChar = document.offsetAt(selection.start);
            let insertToTag = false;
            if (typeOfSelection !== "attribute") {
                // find first character that is not a space before the selection
                const spaceRegex = /\s/s;
                while (firstChar > 0 &&  spaceRegex.exec(document.getText().charAt(firstChar - 1))) {
                    firstChar--;
                }

                // check if first character is >
                if (document.getText().charAt(firstChar - 1) === ">") {
                    insertToTag = true;
                    typeOfSelection = "tag";
                    //find < before firstChar, traversing backward until first <
                    let startTagChar = firstChar;
                    while (startTagChar > 0 && document.getText().charAt(startTagChar - 1) !== "<") {
                        if (document.getText().charAt(startTagChar - 1) === "/"){
                            //if we find a / before <, then we are in a closing tag, so we should stop traversing, abort!
                            insertToTag = false;
                            break;
                        }
                        startTagChar--;
                    }

                    //find th:text or th:utext btween startTagChar and firstChar and then grab their content and position
                    if (insertToTag && startTagChar) {
                        //get text in range from startTagChar to firstChar in document
                        const tagText = document.getText(new vscode.Range(document.positionAt(startTagChar), document.positionAt(firstChar)));

                        const thTextRegex = /th:(text|utext)=["']([^"']+)["']/g;
                        let thTextMatch;
                        while ((thTextMatch = thTextRegex.exec(tagText)) !== null) {
                            text = thTextMatch[2];
                            insertToTag = false;
                            //set new selection on matching th:text or th:utext content
                            selection = new vscode.Selection(document.positionAt(startTagChar + thTextMatch.index + thTextMatch[1].length + 2), document.positionAt(startTagChar + thTextMatch.index + thTextMatch[1].length + 2 + thTextMatch[2].length));
                            typeOfSelection = "attribute";
                            break;
                        
                        }
                    }                    
                }
            }
        
        
            // Process the text
            const resp:any = await this.askForInput(text);
            if (resp !== undefined) {
                if (resp){
                    //escape quotes
                    const escapedText:string = resp.replace(/"/g, '\\"');

                    if (insertToTag && typeOfSelection === "tag") {
                        const newText = " th:text=\""+escapedText+"\"";
                        editor.edit(editBuilder => {
                            editBuilder.insert(document.positionAt(firstChar - 1), newText);
                        });
                    } else if (typeOfSelection === "attribute") {
                        editor.edit(editBuilder => {
                            editBuilder.replace(selection, escapedText);
                        });
                    } else {
                        const newText = "<span th:remove=\"tag\" th:text=\""+escapedText+"\">"+text+"</span>";
                        editor.edit(editBuilder => {
                            editBuilder.replace(selection, newText);
                        });
                    }
                }
                getDecoratorManager().decorateOverlay();
            }
        });
        
        context.subscriptions.push(processSelectionCommand);
    }

    async askForInput(selectionText: string) : Promise<any> {

        const messages = getIndexerManager().getMessages();

        // check if textOrVariable is a variable #{variable} or a translation
        let askForVariable = true;
        let defaultValue: string = '';

        let variableName = "";
        let textContent = "";

        let weHaveVariable = false;

        //trim selection
        selectionText = selectionText.trim();

        if (selectionText.startsWith('#{')) {
            askForVariable = false;
            variableName = selectionText.replace(/#{(.*)}/g, '$1');
            //replace underscores with spaces
            defaultValue = variableName.replace(/_/g, ' ');
            //convert to title case
            defaultValue = defaultValue.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();});
        }else{
            
            // replace newlines with new lines literals
            textContent = selectionText.replace(/(?:\r\n|\r|\n)/g, '\\n');
            
            // Find if we already have same text in the messages files
            Object.values(messages).some((innerObject) => {
                const innerKey = Object.keys(innerObject).find((key) => innerObject[key] === textContent);
                if (innerKey) {
                    variableName = innerKey;
                    return true;
                }
                return false;
            });

            if (variableName) {
                defaultValue = variableName;
                weHaveVariable = true;
            }else{
                // Default variable name
                // replace newlines
                defaultValue = selectionText.replace(/(?:\r\n|\r|\n)/g, '_');
                // replace spaces with underscore
                defaultValue = textContent.replace(/\s/g, '_');
                // convert to lowercase
                defaultValue = defaultValue.toLowerCase();
                // max length 20
                defaultValue = defaultValue.substring(0, 20);
            }
        }

        // Step 1: Ask the user for a variable name
        let promptText: string;
        
        if (askForVariable) {
            promptText = 'Enter a variable name';
            defaultValue = (defaultValue) ? defaultValue : 'Enter variable name here';
        }else{
            promptText = 'Enter translation for current language';
            defaultValue = (defaultValue) ? defaultValue : 'Enter text here';
        }

        let validInput = false;
        let userInput = '';
        let variableNameInTemplate = '';

        while (!validInput) {
            userInput = await vscode.window.showInputBox({
                prompt: promptText,
                value: defaultValue,
            }) || '';

            // trim variableNameOrText
            userInput = userInput.trim();        
            if (!userInput) {
                return; // User cancelled the input
            }
                        
            if (askForVariable) {
                if (weHaveVariable && userInput === variableName) {
                    // if we already have a variable, just return it
                    return '#{'+variableName+'}'; 
                }

                // Remove spaces with dots from variableNameOrText
                variableName = userInput.replace(/\s/g, '.');
                variableName = variableName.toLowerCase();

                if (variableName.startsWith('#{')) {
                    variableName = variableName.replace('#{', '');
                }
                if (variableName.endsWith('}')) {
                    variableName = variableName.replace('}', '');
                }
                variableNameInTemplate = '#{'+variableName+'}';                
            } else {
                textContent = userInput;
            }

            // check if variableNameOrText is already in messages and the type askForVariable, search in subarray of messages
            if (askForVariable && messages && Object.values(messages).some((items) => variableName in items)) {
                vscode.window.showErrorMessage('Variable name already exists');
            } else {
                validInput = true;
                break;
            }
        }
    
        /* Step 2: Ask the user to choose an existing filename or create a new one
        /*         get list of files from keys of messages in IndexerManager of current language
        /*         if it is a variable we get only ones for current language
        /*         if it is a text we get only ones for the default language (D)
        */
        let existingFilenames = Object.keys(messages || {});
        existingFilenames = existingFilenames.filter((filename) => { 
            // filter out files that are not in the current language
            const fileLang = getIndexerManager().getLangFromFileForCheck(filename);
            const currentLang = getLanguageManager().getCurrentLanguageForCheck();
            return (!askForVariable && fileLang === currentLang) || (askForVariable && fileLang === "D");
        });

        const createNewOption = 'Create new file';
    
        const selectedFilename = await vscode.window.showQuickPick([...existingFilenames, createNewOption], {
            placeHolder: 'Select message file to add variable/translation to',
        });
    
        if (!selectedFilename) {
            return; // User cancelled the input
        }
    
        let finalFilename = '';
    
        if (selectedFilename === createNewOption) {
            // Step 3: Ask the user for a new filename
            const newFilename = await vscode.window.showInputBox({
                prompt: 'Enter a new filename',
            });
    
            if (!newFilename) {
                return; // User cancelled the input
            }
            //find folder to store new file, check config first and if not available use first path in messages
            let folder = vscode.workspace.getConfiguration().get<string>(extensionID+'.folder');
            if (!folder) {
                folder = Object.keys(messages)[0];
                //remove filename
                folder = folder.substring(0, folder.lastIndexOf('/'));
            }
            finalFilename = path.join(folder, newFilename);
        } else {
            finalFilename = selectedFilename;
        }
    
        // Use the variableName and finalFilename here
        console.log('Variable name, text and variableNameInTemplate:', variableName + " -" + textContent + " - " + variableNameInTemplate);
        console.log('Filename:', finalFilename);

        // add variableNameOrText to messages

        getIndexerManager().addMessage(finalFilename, variableName, textContent);
        // save messages
        FilesaveManager.savePropertiesFile(finalFilename, variableName, textContent);

        return variableNameInTemplate;
    }
}