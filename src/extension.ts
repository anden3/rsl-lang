import * as vscode from 'vscode';

import * as util from './util';
import { compile } from './rsl-compile';

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
				let openOptions: vscode.OpenDialogOptions;

				if (process.platform === "darwin") {
					openOptions = {
						canSelectFiles: true,
						canSelectFolders: false,
						canSelectMany: false,
						filters: {
							'Application': ['app']
						},
						defaultUri: vscode.Uri.file('/Applications')
					};
				}
				else {
					openOptions = {
						canSelectFolders: true,
						canSelectFiles: false,
						canSelectMany: false
					};
				}

				let selection = await vscode.window.showOpenDialog(openOptions);

				if (selection === undefined || selection.length !== 1) {
					return Promise.reject();
				}
				
				let path = selection[0];
				await config.update('aqsis.path', path.fsPath);

				return validateConfig();
			}
		}
	}
	else if (config.get('aqsis.binPath') === "") {
		let aqsisHome = <string>config.get('aqsis.path');

		util.findDirectoryWithContents(aqsisHome, 'bin', ['aqsisrc'])
			.then(path => config.update('aqsis.binPath', path))
			.catch(() => {
				vscode.window.showErrorMessage("Could not find AQSIS bin path.");
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
	});
}

export function deactivate() {

}
