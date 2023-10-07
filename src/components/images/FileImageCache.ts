import fs from 'fs';

import { getAppPath } from '../../utils/pal';
import { IBitmap, ImageCache } from './ImageProvider';

export class FileImageCache implements ImageCache {
	basePath : string;
	allImages: Set<string>;

	constructor() {
		this.basePath = getAppPath() + '/imagecache/';

		if (!fs.existsSync(this.basePath)) {
			fs.mkdirSync(this.basePath);
		}

		let dirEntries : string[] = fs.readdirSync(this.basePath);

		// Filter to images
		dirEntries = dirEntries.filter(item => item.endsWith('.png'));

		// Remove the .png extension
		this.allImages = new Set(dirEntries.map(item => this.basePath + item));
	}

	getCached(url:string): string {
		if (this.allImages.has(this.formatUrl(url))) {
			return 'file://' + this.formatUrl(url);
		} else {
			return '';
		}
	}

	//TODO: restructure image persistence to use directories instead of flattening them all - makes for very large directories
	formatUrl(url: string): string {
		//HACK: strip first char if startswith some cases to account for previous bug
		let rv = ((url.startsWith('/') || url.startsWith('atlas') || url.startsWith('images')) ? url.substr(1) : url).replace(new RegExp('/', 'g'), '_');
		if (rv.startsWith('currency_')) {
			rv = 'mages_' + rv;
		}
		rv = this.basePath + rv + (url.endsWith('.png') ? '' : '.png');
		return rv;
	}

	async getImage(url: string) : Promise<string | undefined> {
		function delay(ms: number) {
			return new Promise(resolve => setTimeout(resolve, ms));
		}

		// Add an artificial delay to prevent the UI from blocking
		await delay(400);

		const exists = fs.existsSync(this.formatUrl(url));
		//console.log('check exists ' + url + (exists? ' passed':' failed'));
		if (exists) {
			return 'file://' + this.formatUrl(url);
		}
		return undefined;
	}

	bitmapToPng(data: IBitmap, callback: (bytes:Uint8Array) => void) : void {
		let canvas = document.createElement('canvas');
		canvas.height = data.height;
		canvas.width = data.width;

		let ctx = canvas.getContext('2d');
		if (ctx) {
			let myImageData = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
			ctx.putImageData(myImageData, 0, 0);
		}

		canvas.toBlob((blob) => {
			let fileReader = new FileReader();
			fileReader.onload = (progressEvent:any) => { // Use 'any' because result is not found on 'target' for some reason
				callback(new Uint8Array(progressEvent.target.result));
			};
			fileReader.readAsArrayBuffer(blob!);
		});
	}

	saveImage(url: string, data: IBitmap) : Promise<string> {
		return new Promise((resolve, reject) => {
			if (data.data.length > 0) {
				this.bitmapToPng(data, (pngData) => {
					fs.writeFile(this.formatUrl(url), pngData, (err) => {
						resolve('file://' + this.formatUrl(url));
					});
				});
			}
			else {
				reject('Invalid data');
			}
		});
	}
}
