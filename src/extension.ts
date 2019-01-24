import * as vscode from 'vscode';

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

	/*
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World!');
	});

	context.subscriptions.push(disposable);
	*/

	context.subscriptions.push(
		vscode.languages.registerColorProvider(RSL_MODE, new RSLColorProvider())
	);
}

export function deactivate() {

}
