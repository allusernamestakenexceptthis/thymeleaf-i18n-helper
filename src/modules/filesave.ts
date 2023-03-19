import * as vscode from 'vscode';

export class FilesaveManager {

    static async savePropertiesFile(filepath: string, key: string, value: any) {
        try {
            const fileUri = vscode.Uri.file(filepath);

            // Check if the file exists
            let propertiesText = '';
            try {
              const fileStat = await vscode.workspace.fs.stat(fileUri);
              if (fileStat.type === vscode.FileType.File) {
                propertiesText = (await vscode.workspace.fs.readFile(fileUri)).toString();
              }
            } catch (error: any) {
              // File doesn't exist, create it
              if (error.code === 'FileNotFound') {
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(''));
              } else {
                throw error;
              }
            }

            const lines = propertiesText.split('\n');

            let found = false;
            const updatedProps = (await lines).map((line) => {
                if (line.startsWith(key+"=")) {
                    found = true;
                    return `${key}=${value}`;
                }
                return line;
            });

            if (!found) {
                updatedProps.push(`${key}=${value}`);
            }

            const updatedContent = updatedProps.join('\n');
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filepath), Buffer.from(updatedContent));

            vscode.window.showInformationMessage('Properties file updated');
        } catch (e: any) {
            vscode.window.showErrorMessage('Error updating properties file: ' + e.message);
        }
    }

}
