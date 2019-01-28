import * as fs from 'fs';
import * as path from 'path';

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