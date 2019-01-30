import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as jimp from 'jimp';

import * as util from './util';

import { DiagnosticCollection } from './extension';

interface RIBInfo {
    name: string;
    uri: vscode.Uri;
    shaders: string[];
    outImage: string;
}

export async function compile() {
    if (vscode.window.activeTextEditor === undefined) {
        return;
    }

    if (vscode.workspace.workspaceFolders === undefined) {
        return;
    }

    let filePath = vscode.window.activeTextEditor.document.uri;
    let relativePath = vscode.workspace.asRelativePath(filePath);
    let containingFolder = path.dirname(relativePath);

    let ribPath = filePath;

    if (relativePath.endsWith(".sl")) {
        let result: vscode.Uri | undefined;

        if ((result = await findRIBFile(containingFolder)) === undefined) {
            return;
        }

        ribPath = result;
    }

    let info = await getRIBInfo(ribPath);
    if (info === undefined) {
        vscode.window.showErrorMessage(
            `Couldn't load RIB file: ${vscode.workspace.asRelativePath(ribPath)}`
        );
        return;
    }

    let shadersToCompile = await getShadersToCompile(info);
    let shaderCompilationPromises: Promise<void>[] = [];
    let abortCompilation = false;

    shadersToCompile.forEach(shader => {
        let shaderName = path.basename(shader.fsPath);

        let p = compileShader(shader)
            .then(async result => {
                if (result) {
                    if (result.includes('...')) { /*Successful compile*/ }
                    else {
                        console.log(`[LOG][Shader Compilation] ${shaderName}.rib: ${result}`);
                    }
                }
            })
            .catch(async (error: string) => {
                abortCompilation = true;

                let errors = error.split(/\r?\n/);
                handleShaderErrors(shader, errors);
            });
        
        shaderCompilationPromises.push(p);
    });

    await Promise.all(shaderCompilationPromises);

    if (abortCompilation) {
        return;
    }
    else {
        shadersToCompile.forEach(sh => {
            DiagnosticCollection.delete(sh);
        });
    }

    let ribCompileP = compileRIB(info)
        .then(stdout => {
            if (stdout) {
                console.log(`[LOG][RIB Compilation] ${info.name}.rib: ${stdout}`);
            }
        })
        .catch(error => {
            console.error(`[ERROR][RIB Compilation] ${info.name}.rib: ${error}`);
            vscode.window.showErrorMessage(error);
        });
    
    await ribCompileP;

    let imageUri = await convertImage(info);
    await displayImage(imageUri);

    return Promise.resolve();
}

async function getShadersToCompile(info: RIBInfo): Promise<vscode.Uri[]> {
    let ws = <vscode.WorkspaceFolder>vscode.workspace.getWorkspaceFolder(info.uri);

    let compiledShadersP     = getCompiledShaderNames(ws);
    let shadersLastModifiedP = getModifiedTimes(info);

    let compiledShaders     = await compiledShadersP;
    let shadersLastModified = await shadersLastModifiedP;

    let toBeCompiled: vscode.Uri[] = [];

    for (let [shader, mTime] of shadersLastModified) {
        let compiledMTime = compiledShaders.get(path.basename(shader.fsPath, '.sl'));

        if (compiledMTime === undefined || mTime > compiledMTime) {
            toBeCompiled.push(shader);
        }
    }

    return toBeCompiled;
}

async function findRIBFile(containingFolder: string): Promise<vscode.Uri | undefined> {
    return vscode.workspace.findFiles(`${containingFolder}/*.rib`).then(paths => {
        if (paths.length === 0) {
            return undefined;
        }
        else if (paths.length === 1) {
            return paths[0];
        }
        else {
            let map: Map<string, vscode.Uri> = new Map();
            paths.forEach(p => map.set(
                vscode.workspace.asRelativePath(p.fsPath), p)
            );

            let pick = vscode.window.showQuickPick(
                paths.map(uri => vscode.workspace.asRelativePath(uri.fsPath))
            ).then((value) => {
                if (value === undefined || map.get(value) === undefined) {
                    // Dialog was closed before selecting.
                    return undefined;
                }

                return map.get(value);
            });

            return pick;
        }
    });
}

async function getRIBInfo(ribPath: vscode.Uri): Promise<RIBInfo> {
    const imageRgx = /Display\s+"(.+?)"/;
    const shaderRgx = /(?:LightSource|Surface|Displacement)\s+"(\w+?)"/g;

    return new Promise<RIBInfo>((resolve, reject) => {
        fs.readFile(ribPath.fsPath, 'utf8', (err, data) => {
            if (err) {
                vscode.window.showErrorMessage(
                    `Couldn't open file ${vscode.workspace.asRelativePath(ribPath)}: ${err.message}`
                );
                return resolve(undefined);
            }

            let imageMatch = data.match(imageRgx);
            if (imageMatch === null || imageMatch.length === 1) {
                vscode.window.showErrorMessage(
                    `No image target specified in ${vscode.workspace.asRelativePath(ribPath)}`
                );
                return resolve(undefined);
            }

            let image = imageMatch[1];
            let shaders: string[] = [];

            let m : RegExpExecArray | null;
					
		    while (m = shaderRgx.exec(data)) {
                shaders.push(m[1]);
            }

            return resolve({
                name: path.basename(ribPath.fsPath, '.rib'),
                uri: ribPath,
                shaders: shaders,
                outImage: image
            });
        });
    });
}

async function compileShader(shaderUri: vscode.Uri): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const config = vscode.workspace.getConfiguration('rsl');
        const binPath = config.get('aqsis.binPath');
        const compiledShaderPath = <string>config.get('folder.compiledShaders');

        let shaderName = path.basename(shaderUri.fsPath, '.sl');
        let outputFile = `./${compiledShaderPath}/${shaderName}.slx`;

        let workspace = vscode.workspace.getWorkspaceFolder(shaderUri);

        if (workspace === undefined) {
            return reject(`Compilation of ${shaderName} failed: Workspace is no longer available.`);
        }

        if (!fs.existsSync(path.join(workspace.uri.fsPath, compiledShaderPath))) {
            fs.mkdirSync(path.join(workspace.uri.fsPath, compiledShaderPath), { recursive: true});
        }

        cp.exec(`"${binPath}/aqsl" -o "${outputFile}" "${shaderUri.fsPath}"`, {
            'cwd': workspace.uri.fsPath,
            'env': {
                'AQSISHOME': config.get('aqsis.path'),
                'AQSIS_SHADER_PATH': `${compiledShaderPath}/:&`
            }
        }, (error, stdout, stderr) =>
              error  ? reject(error.message)
            : stderr ? reject(stderr)
            : resolve(stdout)
        );
    });
}

async function compileRIB(info: RIBInfo): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const config = vscode.workspace.getConfiguration('rsl');
        const workspace = (<vscode.WorkspaceFolder>vscode.workspace.getWorkspaceFolder(info.uri));

        cp.exec(`"${config.get('aqsis.binPath')}/aqsis" "${info.uri.fsPath}"`, {
            'cwd': workspace.uri.fsPath,
            'env': {
                'AQSISHOME': config.get('aqsis.path'),
                'AQSIS_SHADER_PATH': `${config.get('folder.compiledShaders')}/:&`
            }
        }, (error, stdout, stderr) =>
              error  ? reject(error.message)
            : stderr ? reject(stderr)
            : resolve(stdout)
        ); 
    });
}

async function convertImage(info: RIBInfo): Promise<vscode.Uri> {
    const config = vscode.workspace.getConfiguration('rsl');
    const workspace = (<vscode.WorkspaceFolder>vscode.workspace.getWorkspaceFolder(info.uri));

    let imageFormat = (<string>config.get('images.format')).toLowerCase();
    let imageName = path.basename(info.outImage, path.extname(info.outImage));
    let imagePath = path.join(
        workspace.uri.fsPath,
        <string>config.get('folder.images')
    );

    if (!fs.existsSync(imagePath)) {
        fs.mkdirSync(imagePath);
    }

    if (config.get('images.keepHistory')) {
        imagePath = path.join(imagePath, imageName);

        if (!fs.existsSync(imagePath)) {
            fs.mkdirSync(imagePath);
        }
        if (!config.get('images.timestamp')) {
            imageName = fs.readdirSync(imagePath).length.toString();
        }
    }
    else {
        // Delete history.
        let historyFolder = path.join(imagePath, imageName);

        if (fs.existsSync(historyFolder)) {
            fs.readdirSync(historyFolder).forEach(file => {
                fs.unlinkSync(path.join(historyFolder, file));
            });

            fs.rmdirSync(historyFolder);
        }
    }

    if (config.get('images.timestamp')) {
        imageName = util.getLocalISOString(new Date());
    }

    let input = path.join(workspace.uri.fsPath, info.outImage);
    let output = `${path.join(imagePath, imageName)}.${imageFormat}`;

    await jimp.read(input).then(image => {
        image.writeAsync(output);
    }).catch(err => {
        // TODO: Handle errors.
        console.error(err);
    });

    await fs.unlink(input, err => {
        if (err) {
            // TODO: Handle errors.
            console.error(err);
        }
    });

    return vscode.Uri.file(output);
}

async function displayImage(path: vscode.Uri) {
    return vscode.commands.executeCommand('vscode.open', path, vscode.ViewColumn.Beside);
}

async function handleShaderErrors(shader: vscode.Uri, errors: string[]): Promise<void> {

    const diagnosticMap: Map<RegExp, (match: RegExpExecArray) => Promise<vscode.Diagnostic | void>> = new Map([
        [/Command failed/, (match: RegExpExecArray): Promise<vscode.Diagnostic | void> => {
            return Promise.resolve();
        }],

        [/Shader not compiled/, (match: RegExpExecArray) => {
            return Promise.resolve(new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                "Maximum number of errors reached.", vscode.DiagnosticSeverity.Information
            ));
        }],

        [/Unresolved function (\w+) will be/, (match: RegExpExecArray) => {
            return new Promise<vscode.Diagnostic>(async (resolve, reject) => {

                let defaultRange = await util.getRange(shader, new RegExp(match[1] + "\\("));

                let range = defaultRange.with({
                    end: defaultRange.end.translate(0, -1)
                });
                
                return resolve(new vscode.Diagnostic(
                    range,
                    "Unknown function name. Check if it's spelled correctly."
                ));
            });
        }],

        [/(\d+) : syntax error/, (match: RegExpExecArray) => {
            return new Promise<vscode.Diagnostic>(async (resolve, reject) => {
                let lineNum = parseInt(match[1]) - 1;
                let line = await util.getLine(shader, lineNum);

                let m = /^(\s*)(.+)$/.exec(line);

                if (m === null) {
                    console.error(`Cannot match line: ${line}`);
                    debugger;
                    return reject();
                }

                return resolve(new vscode.Diagnostic(
                    new vscode.Range(lineNum, m[1].length, lineNum, m[1].length + m[2].length),
                    "Syntax error."
                ));
            });
        }],

        [/(\d+) : Arguments to function not valid : (\w+)/, (match: RegExpExecArray) => {
            return new Promise<vscode.Diagnostic>(async (resolve, reject) => {
                let lineNum = parseInt(match[1]);
                let argsRgx = new RegExp(`${match[2]}\\((.+)\\)`);

                let line = await util.getLine(shader, lineNum);
                let m = argsRgx.exec(line);

                if (m === null) {
                    console.error("Cannot match function arguments.");
                    debugger;
                    return reject();
                }

                // See if it's possible to match multi-line arguments.
                let range = new vscode.Range(
                    lineNum, match[2].length + m.index + 1,
                    lineNum, match[2].length + m.index + m[1].length + 1
                );

                return resolve(new vscode.Diagnostic(
                    range, "Function arguments are invalid."
                ));
            });
        }]
    ]);
    
    // Delete the compiled shader as it is non-functional.
    const workspace = (<vscode.WorkspaceFolder>vscode.workspace.getWorkspaceFolder(shader));
    const config = vscode.workspace.getConfiguration('rsl');

    let compiledShader = path.join(
        workspace.uri.fsPath,
        <string>config.get('folder.compiledShaders'),
        path.basename(shader.fsPath, path.extname(shader.fsPath)) + ".slx"
    );

    if (fs.existsSync(compiledShader)) {
        fs.unlink(compiledShader, err => !err || console.error(err));
    }

    let promiseArray: Promise<vscode.Diagnostic | void>[] = [];

    errors.forEach(error => {
        if (error !== "") {
            let hasMatched = false;

            for (let [rgx, func] of diagnosticMap) {
                let match;
        
                if ((match = rgx.exec(error)) !== null) {
                    hasMatched = true;
                    promiseArray.push(func(match));
                }
            }

            if (!hasMatched) {
                console.error(JSON.stringify(error));
            }
        }
    });

    if (promiseArray.length > 0) {
        let diagnostics = await Promise.all(promiseArray);
        DiagnosticCollection.set(shader, <vscode.Diagnostic[]>diagnostics.filter(
            (value) => value instanceof vscode.Diagnostic
        ));
    }

    return Promise.resolve();
}

async function getCompiledShaderNames(workspace: vscode.WorkspaceFolder)
    : Promise<Map<string, number>>
{
    const config = vscode.workspace.getConfiguration('rsl');
    const shaderPath = config.get('folder.compiledShaders');

    let pattern = new vscode.RelativePattern(workspace, `${shaderPath}/*.slx`);

    return vscode.workspace.findFiles(pattern).then(files => {
        let map: Map<string, number> = new Map();
        files.forEach(uri => map.set(
            path.basename(uri.fsPath, '.slx'),
            fs.statSync(uri.fsPath).mtimeMs)
        );

        return map;
    });
}

async function getModifiedTimes(info: RIBInfo) : Promise<Map<vscode.Uri, number>> {
    let dirPath = path.join(info.uri.fsPath, '..');

    return vscode.workspace.findFiles(new vscode.RelativePattern(dirPath, "*.sl")).then(files => {
        let map: Map<vscode.Uri, number> = new Map();
        files.forEach(uri => map.set(uri, fs.statSync(uri.fsPath).mtimeMs));

        return map;
    });
}