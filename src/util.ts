import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as readline from 'readline';

export function getLocalISOString(date: Date): string {
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    const newDate = new Date(date.getTime() - offsetMs).toISOString();
    return newDate.split('.')[0].replace('T', ' ').replace(new RegExp(':', 'g'), '-');
}

export async function findDirectoryWithContents(
    start: string, name: string, contents: string[], maxIter: number = 100
): Promise<string> {

    return new Promise<string>((resolve, reject) => {
        let visited: Set<string> = new Set();
        let queue: string[] = [start];

        let count = 0;

        while (queue.length > 0 || count > maxIter) {
            count++;
            let dir = queue.shift();

            if (dir === undefined) {
                continue;
            }

            for (let f of fs.readdirSync(dir)) {
                const res = path.resolve(dir, f);

                if (visited.has(f) || !fs.statSync(res).isDirectory()) {
                    continue;
                }

                if (f === name) {
                    let match = contents.every((value): boolean => {
                        return fs.existsSync(path.join(res, value));
                    });
                    
                    if (match) {
                        resolve(res);
                        return res;
                    }
                }

                queue.push(res);
                visited.add(res);
            }
        }

        reject();
    });
}

export async function getRange(file: vscode.Uri, search: RegExp): Promise<vscode.Range> {
    return new Promise<vscode.Range>((resolve, reject) => {
        let rd = readline.createInterface({
            input: fs.createReadStream(file.fsPath),
            terminal: false,
            crlfDelay: Infinity
        });

        let lineCount = 0;

        rd.on('line', (line: string) => {
            let match = search.exec(line);

            if (match !== null) {
                return resolve(new vscode.Range(
                    lineCount, match.index, lineCount, match.index + match[0].length
                ));
            }

            lineCount++;
        });

        rd.on("close", () => {
            return reject("No match found.");
        });
    });
}

export async function getLine(file: vscode.Uri, lineNumber: number) : Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let rd = readline.createInterface({
            input: fs.createReadStream(file.fsPath),
            terminal: false,
            crlfDelay: Infinity
        });

        let lineCount = 0;

        rd.on('line', (line: string) => {
            if (lineCount++ === lineNumber) {
                return resolve(line);
            }
        });

        rd.on("close", () => {
            return reject(
                `${path.basename(file.fsPath)} contains ${lineCount} lines, which is less than ${lineNumber}.`
            );
        });
    });
}

export async function promptSelectFolder(
    defaultUri?: vscode.Uri, filters?: { [name: string]: string[]}): Promise<vscode.Uri> {
    
    return new Promise<vscode.Uri>(async (resolve, reject) => {
        let openOptions: vscode.OpenDialogOptions = {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: filters,
            defaultUri: defaultUri
        };

        let selection = await vscode.window.showOpenDialog(openOptions);

        if (selection === undefined || selection.length !== 1) {
            return reject();
        }
        
        return resolve(selection[0]);
    });       
}