import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as jimp from 'jimp';

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

    let shaderCompilationPromises: Promise<null>[] = [];

    shadersToCompile.forEach(shader => {
        shaderCompilationPromises.push(compileShader(shader));
    });

    await Promise.all(shaderCompilationPromises).catch(reason => {
        vscode.window.showErrorMessage(reason);
        return;
    });

    let ribCompileP = compileRIB(info);
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
                resolve(undefined);
                return;
            }

            let imageMatch = data.match(imageRgx);
            if (imageMatch === null || imageMatch.length === 1) {
                vscode.window.showErrorMessage(
                    `No image target specified in ${vscode.workspace.asRelativePath(ribPath)}`
                );
                resolve(undefined);
                return;
            }

            let image = imageMatch[1];
            let shaders: string[] = [];

            let m : RegExpExecArray | null;
					
		    while (m = shaderRgx.exec(data)) {
                shaders.push(m[1]);
            }

            resolve({
                name: path.basename(ribPath.fsPath, '.rib'),
                uri: ribPath,
                shaders: shaders,
                outImage: image
            });
        });
    });
}

async function compileShader(shaderUri: vscode.Uri): Promise<null> {
    return new Promise<null>((resolve, reject) => {
        const config = vscode.workspace.getConfiguration('rsl');
        const binPath = config.get('aqsis.binPath');
        const compiledShaderPath = config.get('compiledShaderFolder');

        let shaderName = path.basename(shaderUri.fsPath, '.sl');
        let outputFile = `./${compiledShaderPath}/${shaderName}.slx`;

        let workspace = vscode.workspace.getWorkspaceFolder(shaderUri);

        if (workspace === undefined) {
            reject(`Compilation of ${shaderName} failed: Workspace is no longer available.`);
            return;
        }

        cp.exec(`${binPath}/aqsl -o ${outputFile} ${shaderUri.fsPath}`, {
            'cwd': workspace.uri.fsPath,
            'env': {
                'AQSISHOME': config.get('aqsis.path'),
                'AQSIS_SHADER_PATH': `${compiledShaderPath}/:&`
            }
        }, (error, stdout, stderr) => {
            if (error) {
                reject(`Compilation of ${shaderName} failed: ${error.message}`);
                return;
            }

            if (stdout) {
                console.log(`[LOG][Shader Compilation] ${shaderName}.rib: ${stdout}`);
            }
            if (stderr) {
                console.error(`[ERROR][Shader Compilation] ${shaderName}.rib: ${stderr}`);
            }

            resolve();
        });
    });
}

async function compileRIB(info: RIBInfo): Promise<null> {
    return new Promise<null>((resolve, reject) => {
        const config = vscode.workspace.getConfiguration('rsl');
        const workspace = (<vscode.WorkspaceFolder>vscode.workspace.getWorkspaceFolder(info.uri));

        cp.exec(`${config.get('aqsis.binPath')}/aqsis ${info.uri.fsPath}`, {
            'cwd': workspace.uri.fsPath,
            'env': {
                'AQSISHOME': config.get('aqsis.path'),
                'AQSIS_SHADER_PATH': `${config.get('compiledShaderFolder')}/:&`
            }
        }, (error, stdout, stderr) => {
            if (error) {
                reject(`Compilation of ${info.name}.rib failed: ${error.message}`);
                return;
            }

            if (stdout) {
                console.log(`[LOG][RIB Compilation] ${info.name}.rib: ${stdout}`);
            }
            if (stderr) {
                console.error(`[ERROR][RIB Compilation] ${info.name}.rib: ${stderr}`);
            }

            resolve();
        }); 
    });
}

async function convertImage(info: RIBInfo): Promise<vscode.Uri> {
    const config = vscode.workspace.getConfiguration('rsl');
    const workspace = (<vscode.WorkspaceFolder>vscode.workspace.getWorkspaceFolder(info.uri));

    let input = path.join(workspace.uri.fsPath, info.outImage);
    let output = path.join(
        workspace.uri.fsPath,
        <string>config.get('renderedImageFolder'),
        path.basename(info.outImage, path.extname(info.outImage)) + ".png"
    );

    await jimp.read(input).then(image => {
        image.writeAsync(output);
    }).catch(err => {
        console.error(err);
    });

    await fs.unlink(input, err => {
        if (err) {
            console.error(err);
        }
    });

    return vscode.Uri.file(output);
}

async function displayImage(path: vscode.Uri) {
    return vscode.commands.executeCommand('vscode.open', path, vscode.ViewColumn.Beside);
}

async function getCompiledShaderNames(workspace: vscode.WorkspaceFolder)
    : Promise<Map<string, number>>
{
    const config = vscode.workspace.getConfiguration('rsl');
    const shaderPath = config.get('compiledShaderFolder');

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