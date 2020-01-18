import * as fs from 'fs';
import * as vscode from 'vscode';

import * as util from './util';
import { compile } from './rsl-compile';

export var DiagnosticCollection: vscode.DiagnosticCollection;

class RSLColorProvider implements vscode.DocumentColorProvider {
	colorRgx: RegExp = /color\s*\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*\)/g;

	public provideDocumentColors(
		document: vscode.TextDocument, token: vscode.CancellationToken):
		Thenable<vscode.ColorInformation[]> 
	{
		const p: Promise<vscode.ColorInformation[]> = new Promise((resolve, reject) => {
				let colors: vscode.ColorInformation[] = [];
				
				for (let l = 0; l < document.lineCount; l++) {
					let m : RegExpExecArray | null;
					
					while (m = this.colorRgx.exec(document.lineAt(l).text)) {
						let range = new vscode.Range(l, m.index, l, m.index + m[0].length);
						
						let colorComponents: number[] = m.slice(1, 4).map((value: string) => parseFloat(value));
						let color = new vscode.Color(colorComponents[0], colorComponents[1], colorComponents[2], 1);

						colors.push(new vscode.ColorInformation(range, color));
					}
				}

				resolve(colors);
			}
		);
		
		return p;
	}

	public provideColorPresentations(
		color: vscode.Color, context: { document: vscode.TextDocument, range: vscode.Range }, token: vscode.CancellationToken):
		Thenable<vscode.ColorPresentation[]>
	{
		const p: Promise<vscode.ColorPresentation[]> = new Promise((resolve, reject) => {
				let label = "color(" + color.red.toFixed(2) + ", " + color.green.toFixed(2) + ", " + color.blue.toFixed(2) + ")";

				let colorPres: vscode.ColorPresentation[] = [
					new vscode.ColorPresentation(label)
				];

				resolve(colorPres);
			}
		);

		return p;
	}
}

async function validateConfig(): Promise<void> {
	const AQSIS_DOWNLOAD_URL: string = "https://sourceforge.net/projects/aqsis/";

	let config = vscode.workspace.getConfiguration('rsl');

	if (config.get('aqsis.path') === "") {
		// First try with some default installation paths.
		switch (process.platform) {
			case "darwin":
				if (fs.existsSync('/Applications/Aqsis.app')) {
					await config.update('aqsis.path', '/Applications/Aqsis.app');
					console.log(
						"[LOG][RSL Config] Found AQSIS installation at '/Applications/Aqsis.app'"
					);

					return validateConfig();
				}
				break;
			
			case "win32":
				if (fs.existsSync('c:/Program Files (x86)/Aqsis')) {
					await config.update('aqsis.path', 'c:/Program Files (x86)/Aqsis');
					console.log(
						"[LOG][RSL Config] Found AQSIS installation at 'C:\\Program Files (x86)\\Aqsis'"
					);

					return validateConfig();
				}
				break;
		}

		let answer = await vscode.window.showErrorMessage(
			"The path to AQSIS Renderer is not defined!",{ modal: false },
			"Download AQSIS",
			"Choose Path..."
		);

		if (answer === undefined) {
			return Promise.reject();
		}

		switch (answer) {
			case "Download AQSIS": {
				vscode.env.openExternal(vscode.Uri.parse(AQSIS_DOWNLOAD_URL));
				break;
			}
			case "Choose Path...": {
				let pathP: Promise<vscode.Uri>;

				switch (process.platform) {
					case "darwin":
						pathP = util.promptSelectFolder(
							vscode.Uri.file('/Applications'), { 'Application': ['app'] }
						);
						break;
					
					case "win32":
						pathP = util.promptSelectFolder(vscode.Uri.file('C:/Program Files (x86)'));
						break;
					
					default:
						pathP = util.promptSelectFolder();
				}

				let path = await pathP.catch(() => {
					return Promise.reject();
				});

				await config.update('aqsis.path', path.fsPath);
				console.log(
					`[LOG][RSL Config] Found AQSIS installation at '${path.fsPath}'`
				);

				return validateConfig();
			}

			case "Install AQSIS": {
				vscode.commands.executeCommand(
					'vscode.open', vscode.Uri.parse('https://sourceforge.net/projects/aqsis/')
				);
				return;
			}
		}
	}
	else if (config.get('aqsis.binPath') === "") {
		let aqsisHome = <string>config.get('aqsis.path');

		return util.findDirectoryWithContents(aqsisHome, 'bin', ['aqsisrc'])
			.then(path => {
				config.update('aqsis.binPath', path);
				console.log(
					`[LOG][RSL Config] Found AQSIS Bin Path at '${path}'`
				);
			})
			.catch(() => {
				let answer = vscode.window.showErrorMessage(
					"Could not find AQSIS bin path.", "Choose Path..."
				);

				if (answer === undefined) { Promise.reject(); }
				
				return util.promptSelectFolder()
					.then(path => config.update('aqsis.binPath', path.fsPath))
					.catch(() => { return Promise.reject(); });
			});
	}

	return Promise.resolve();
}

export function activate(context: vscode.ExtensionContext) {
	const RSL_MODE: vscode.DocumentFilter = { language: 'rsl', scheme: 'file' };

	validateConfig().then(() => {
		// Listeners.
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration('rsl')) {
					validateConfig();
				}
			})
		);

		// Commands.
		context.subscriptions.push(
			vscode.commands.registerCommand('rsl-lang.compileRIB', compile)
		);

		// Providers.
		context.subscriptions.push(
			vscode.languages.registerColorProvider(RSL_MODE, new RSLColorProvider())
		);

		DiagnosticCollection = vscode.languages.createDiagnosticCollection('rsl');
		context.subscriptions.push(DiagnosticCollection);
	});
}

export function deactivate() {

}
