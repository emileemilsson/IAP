import fs from 'fs';
import axios, { AxiosRequestConfig } from 'axios';

import { getAppPath } from '../../utils/pal';
import { IBitmap, ImageCache } from './ImageProvider';
import CONFIG from "../../api/CONFIG";

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
		//console.log(' set url ' + url);
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
		if(data.data == null)
		{
			console.log(' image url' + url);

			let textAfterLastImage = '';
			  if (url.startsWith('/crew_icons')) {

	    		    textAfterLastImage = 'crew_icons_' + url.substring(12);
	       		    }
			  if (url.startsWith('/crew_portraits')) {

	    		    textAfterLastImage = 'crew_portraits_' + url.substring(16);
	       		    }
			  if (url.startsWith('/crew_full_body')) {

	    		    textAfterLastImage = 'crew_full_body_' + url.substring(16);
	       		    }
			  if (url.startsWith('/ship_previews')) {

	    		    textAfterLastImage = 'ship_previews_' + url.substring(15);
	       		    }
	       		    console.log('cut : ' + textAfterLastImage);

			downloadAndSavePngFromUrl('https://assets.datacore.app/'+ textAfterLastImage + '.png', this.formatUrl(url));
		}
	
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
async function downloadAndSavePngFromUrl(url: string, localFilePath: string) {
  try {
    // Fetch the PNG file from the URL
    const response = await axios.get(url, { responseType: 'arraybuffer' } as AxiosRequestConfig<any>);

    const buffer = Buffer.from(response.data);
    
    // Write the fetched data to a file on the local disk
    fs.writeFile(localFilePath, buffer, (err) => {
      if (err) {
        console.error('Error writing PNG file:', err);
      } else {
        console.log('PNG file downloaded and saved successfully!');
      }
    });
  } catch (error) {
    console.error('Error fetching the PNG file:', error);
  }
}

