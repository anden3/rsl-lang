import * as path from 'path';
import * as vscode from 'vscode';

import { compileRIB } from './rsl-compile'

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

export function activate(context: vscode.ExtensionContext) {
	const RSL_MODE: vscode.DocumentFilter = { language: 'rsl', scheme: 'file' };

	let config = vscode.workspace.getConfiguration('rsl');

	if (config.get('aqsis.path') === null) {
		vscode.window.showErrorMessage("rsl.aqsis.path is not defined!");
		// TODO: Let user fix this.
		return;
	}
	else if (config.get('aqsis.binPath') === null) {
		let aqsisHome = config.get('aqsis.path');
		if (aqsisHome === undefined) {
			throw Error("aqsis.path is not null but it is undefined.");
		}

		let newPath = <string>aqsisHome;

		switch (process.platform) {
			case "darwin":
				newPath = path.join(newPath, "Contents/Resources/bin"); break;
			case "win32":
				newPath = path.join(newPath, "bin"); break;
			default:
				vscode.window.showErrorMessage(
					"Your operating system is unfortunately not supported yet. \
					Please make an issue on 'https://github.com/anden3/rsl-lang/issues' with your system details."
				);
				return;
		}

		config.update('aqsis.binPath', newPath);
	}

	let disposable = vscode.commands.registerCommand('rsl-lang.compileRIB', compileRIB);

	context.subscriptions.push(disposable);

	context.subscriptions.push(
		vscode.languages.registerColorProvider(RSL_MODE, new RSLColorProvider())
	);
}

export function deactivate() {

}
