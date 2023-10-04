// #!if ENV === 'electron'
import electron from 'electron';
import fs from 'fs';
import os from 'os';
const app = electron.app || electron.remote.app;
const shell = electron.shell || electron.remote.shell;
const dialog = electron.dialog || electron.remote.dialog;

import { ipcRenderer } from 'electron';
// #!endif

export function getAppVersion(): string {
	// #!if ENV === 'electron'
	return app.getVersion();
	// #!else
	return process.env.APP_VERSION + '-web';
	// #!endif
}

export function getAppPath(): string {
	// #!if ENV === 'electron'
	return app.getPath('userData');
	// #!else
	throw new Error('can not get app path on web');
	// #!endif
}

export function getOSDetails(): string {
	// #!if ENV === 'electron'
	return `${os.platform()} ${os.arch()} (${os.release()})`;
	// #!else
	return navigator.userAgent;
	// #!endif
}

export function openDevTools(): void {
	// #!if ENV === 'electron'
	ipcRenderer.send('open-dev-tools', '');
	// #!else
	alert('Open the developer tools by pressing F12');
	// #!endif
}

export function openShellExternal(url: string): void {
	// #!if ENV === 'electron'
	shell.openExternal(url);
	// #!else
	window.open(url, '_blank');
	// #!endif
}

export function download(filename: string, text: any, title: string, buttonLabel: string, openOnSave = true, path?: string) {
	let extension: string = filename.split('.').pop()!;
	// #!if ENV === 'electron'
	let extName = '';
	if (extension === 'csv') {
		extName = 'Comma separated file (*.csv)';
	} else if (extension === 'xlsx') {
		extName = 'Excel spreadsheet (*.xlsx)';
	} else if (extension === 'json') {
		extName = 'JSON formatted file (*.json)';
	} else if (extension === 'html') {
		extName = 'HTML file (*.html)';
	}

	if (!path) {
		dialog
			.showSaveDialog({
				filters: [{ name: extName, extensions: [extension] }],
				title: title,
				defaultPath: filename,
				buttonLabel: buttonLabel
			})
			.then(({ filePath }) => {
				if (filePath === undefined) return;

				fs.writeFile(filePath, text, err => {
					if (!err && openOnSave) {
						shell.openItem(filePath);
					}
				});
			});
	}
	else {
		fs.writeFile(path + filename, text, err => {
			if (!err && openOnSave) {
				shell.openItem(path + filename);
			}
		});
	}
	// #!else
	let mimeType = '';
	let isText = true;
	if (extension === 'csv') {
		mimeType = 'text/csv;charset=utf-8';
	} else if (extension === 'xlsx') {
		mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		isText = false;
	} else if (extension === 'json') {
		mimeType = 'text/json;charset=utf-8';
	} else if (extension === 'html') {
		mimeType = 'text/html;charset=utf-8';
	}

	function downloadData(dataUrl: string, fn: string) {
		let pom = document.createElement('a');
		pom.setAttribute('href', dataUrl);
		pom.setAttribute('download', fn);

		if (document.createEvent) {
			let event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			pom.dispatchEvent(event);
		} else {
			pom.click();
		}
	}

	if (isText) {
		downloadData(`data:${mimeType},${encodeURIComponent(text)}`, filename);
	} else {
		var a = new FileReader();
		a.onload = (e: any) => {
			downloadData(e.target.result, filename);
		};
		a.readAsDataURL(text);
	}
	// #!endif
}
