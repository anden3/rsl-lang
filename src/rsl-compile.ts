import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as cp from 'child_process';

interface RIBInfo {
    uri: vscode.Uri;
    shaders: string[];
    outImage: string;
}

export async function compileRIB() {
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

    let info             = await getRIBInfo(ribPath);
    let shadersToCompile = await getShadersToCompile(info);

    let shaderCompilationPromises: Promise<null>[] = [];

    shadersToCompile.forEach(shader => {
        shaderCompilationPromises.push(compileShader(shader));
    });

    await Promise.all(shaderCompilationPromises);

    return Promise.resolve();
}

async function getShadersToCompile(info: RIBInfo): Promise<vscode.Uri[]> {
    let ws = <vscode.WorkspaceFolder>vscode.workspace.getWorkspaceFolder(info.uri);

    let compiledShadersP     = getCompiledShaders(ws);
    let shadersLastModifiedP = getModifiedTimes(info);

    let compiledShaders     = await compiledShadersP;
    let shadersLastModified = await shadersLastModifiedP;

    let toBeCompiled: vscode.Uri[] = [];

    for (let [shader, mTime] of shadersLastModified) {
        if (!compiledShaders.has(shader)) {
            toBeCompiled.push(shader);
        }
        else {
            let compiledMTime;
            if ((compiledMTime = compiledShaders.get(shader)) !== undefined) {
                if (mTime > compiledMTime) {
                    toBeCompiled.push(shader);
                }
            }
            else {
                console.log("This shouldn't happen.");
                toBeCompiled.push(shader);
            }
        }
    }

    return toBeCompiled;
}

async function findRIBFile(containingFolder: string): Promise<vscode.Uri | undefined> {
    return vscode.workspace.findFiles(`${containingFolder}/*.rib`).then((paths: vscode.Uri[]) => {
        if (paths.length > 1) {
            let map: Map<string, vscode.Uri> = new Map();

            paths.forEach(p => {
                map.set(p.fsPath, p);
            });

            let pick = vscode.window.showQuickPick(paths.map((uri: vscode.Uri) => uri.fsPath)).then((value) => {
                if (value === undefined) {
                    console.error("Quick pick returned undefined value.");
                    return undefined;
                }

                return map.get(value);
            });

            return pick;
        }
        else {
            return paths[0];
        }
    });
}

async function getRIBInfo(ribPath: vscode.Uri): Promise<RIBInfo> {
    const imageRgx = /Display\s+"(.+?)"/;
    const shaderRgx = /(?:LightSource|Surface|Displacement)\s+"(\w+?)"/g;

    return new Promise<RIBInfo>((resolve, reject) => {
        fs.readFile(ribPath.fsPath, 'utf8', (err, data) => {
            if (err) {
                throw err;
            }

            let imageMatch = data.match(imageRgx);
            if (imageMatch === null || imageMatch.length === 1) {
                throw SyntaxError("No image target specified in " + ribPath);
            }

            let image = imageMatch[1];
            let shaders: string[] = [];

            let m : RegExpExecArray | null;
					
		    while (m = shaderRgx.exec(data)) {
                shaders.push(m[1]);
            }

            resolve({
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
            reject("Workspace is no longer available.");
            return;
        }

        let process = cp.exec(`${binPath}/aqsl -o ${outputFile} ${shaderUri.fsPath}`, {
            'cwd': workspace.uri.fsPath,
            'env': {
                'AQSISHOME': config.get('aqsis.path'),
                'AQSIS_SHADER_PATH': `${compiledShaderPath}/:&`
            }
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(error);
                throw(error);
            }
            console.log(stdout);
            console.error(stderr);

            resolve();
        });
    });
}

async function getCompiledShaders(workspace: vscode.WorkspaceFolder): Promise<Map<vscode.Uri, number>> {
    // const config = vscode.workspace.getConfiguration('rsl');
    // const shaderPath = config.get('compiledShaderFolder');

    // let pattern = new vscode.RelativePattern(workspace, `${shaderPath}/*.slx`);
    let pattern = new vscode.RelativePattern(workspace, '**/*.slx');

    return vscode.workspace.findFiles(pattern).then((paths: vscode.Uri[]) => {
        let map: Map<vscode.Uri, number> = new Map();

        paths.forEach(uri => {
            let stats = fs.statSync(uri.fsPath);
            map.set(uri, stats.mtimeMs);
        });

        return map;
    });
}

async function getModifiedTimes(info: RIBInfo) : Promise<Map<vscode.Uri, number>> {
    let dirPath = path.join(info.uri.fsPath, '..');

    return vscode.workspace.findFiles(
        new vscode.RelativePattern(dirPath, "*.sl")).then((files: vscode.Uri[]) => {
            let map: Map<vscode.Uri, number> = new Map();

            files.forEach(file => {
                let stats = fs.statSync(file.fsPath);
                map.set(file, stats.mtimeMs);
            });

            return map;
        });
}