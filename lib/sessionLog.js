import fs from 'fs';
import path from 'path';

export class SessionLog {
    constructor(sessionFolder) {
        this._folder = sessionFolder;
        this._file = path.join(this._folder, 'session.md');
        this._ordinal = 0;
        this._lastModified = 0;
    }

    static async create(config) {
        const sessionFolder = path.join(process.cwd(), `session-${Date.now()}`);
        await fs.promises.mkdir(sessionFolder, { recursive: true });
        console.error(`Session: ${sessionFolder}`);
        return new SessionLog(sessionFolder);
    }

    lastModified() {
        return this._lastModified;
    }

    async logResponse(response) {
        this._lastModified = performance.now();
        const prefix = `${(++this._ordinal).toString().padStart(3, '0')}`;
        const lines = [
            `### Tool call: ${response.toolName}`,
            `- Args`,
            '```json',
            JSON.stringify(response.toolArgs, null, 2),
            '```',
        ];

        if (response.result()) {
            lines.push(
                response.isError() ? `- Error` : `- Result`,
                '```',
                response.result(),
                '```'
            );
        }

        if (response.code()) {
            lines.push(
                `- Code`,
                '```js',
                response.code(),
                '```'
            );
        }

        const snapshot = await response.snapshot();
        if (snapshot) {
            const fileName = `${prefix}.snapshot.yml`;
            await fs.promises.writeFile(path.join(this._folder, fileName), snapshot);
            lines.push(`- Snapshot: ${fileName}`);
        }

        for (const image of response.images()) {
            const fileName = `${prefix}.screenshot.${this._extension(image.contentType)}`;
            await fs.promises.writeFile(path.join(this._folder, fileName), image.data);
            lines.push(`- Screenshot: ${fileName}`);
        }

        lines.push('', '', '');
        await this._appendLines(lines);
    }

    async logActions(actions) {
        if (actions?.[0]?.action?.name === 'navigate' && actions[0].timestamp - this._lastModified < 1000)
            return;

        this._lastModified = performance.now();
        const lines = [];
        for (const action of actions) {
            const prefix = `${(++this._ordinal).toString().padStart(3, '0')}`;
            lines.push(`### User action: ${action.action.name}`);
            
            if (action.code) {
                lines.push(
                    `- Code`,
                    '```js',
                    action.code,
                    '```'
                );
            }
            
            if (action.action.ariaSnapshot) {
                const fileName = `${prefix}.snapshot.yml`;
                await fs.promises.writeFile(path.join(this._folder, fileName), action.action.ariaSnapshot);
                lines.push(`- Snapshot: ${fileName}`);
            }
            
            lines.push('', '', '');
        }

        await this._appendLines(lines);
    }

    async _appendLines(lines) {
        await fs.promises.appendFile(this._file, lines.join('\n'));
    }

    _extension(contentType) {
        if (contentType === 'image/jpeg')
            return 'jpg';
        return 'png';
    }
}