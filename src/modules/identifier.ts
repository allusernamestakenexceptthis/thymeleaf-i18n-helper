import * as fs from 'fs';
import * as path from 'path';

function getExtensionIdentifier(): string {
    // Get the path to the current script's directory
    const currentScriptDirectory = path.dirname(__filename);

    // Get the path to the package.json file
    const packageJsonPath = path.join(currentScriptDirectory, '..', 'package.json');

    // Read the package.json file and parse its content
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    // Return the 'name' property as the extension identifier
    return packageJson['name'];
}

// Define the 'extensionID' constant using the getExtensionIdentifier function
export const extensionID = getExtensionIdentifier();