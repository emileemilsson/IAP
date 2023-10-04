import STTApi from "../../api/index";
import CONFIG from "../../api/CONFIG";
import { ImageProvider, FoundResult, ImageCache, CrewImageData, ItemImageData } from './ImageProvider';
import { ShipDTO, FactionDTO } from "../../api/DTO";

const fs = require('fs');
const request = require('request');
var saveImageToDisk = function (uri:string, filename:string, callback:() => void) {
	request.head(uri, function (err:any, res:any, body:any) {
		request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
	});
};

// download and cache wiki images with asset bundle images and load the same way
async function getWikiImageUrl<T>(fileName: string, id: T, path?: string | undefined): Promise<FoundResult<T>> {
	let entry = await STTApi.wikiImages.where('fileName').equals(fileName).first();
	if (entry) {
		if (entry.url) {
			if (path) {
				// let path = '/home/local/CITD/paul.bilnoski/Documents/stt/imagecache/';
				// if (file) {
				// 	if (file.startsWith('/'))
				// 		file = file.substr(1);
				// 	file = file.replace(new RegExp('/', 'g'), '_')
				// 	if (!file.endsWith('.png'))
				// 		file += '.png'
				// 	path += file;
				// }
				// else {
				// 	path += id + '.png';
				// }
				saveImageToDisk(entry.url, path, () => { console.log('Cached new image: ' + path)});
			}
			return { id, url: entry.url };
		} else {
			if ((Date.now() - entry.lastQueried) / 3600000 < CONFIG.HOURS_TO_RECOVERY) {
				throw new Error('The Wiki didn\'t have an image for ' + fileName);
			}
		}
	}

	let data = await STTApi.networkHelper.get('https://stt.wiki/w/api.php', {
			action: 'query',
			titles: 'File:' + fileName + "|File:" + fileName.replace('png', 'PNG') + "|File:" + fileName.replace('.png', '_Full.png') + "|File:" + fileName.replace('_', '-'),
			prop: 'imageinfo',
			iiprop: 'url|metadata',
			format: 'json'
		});

	let foundUrl = undefined;
	Object.keys(data.query.pages).forEach((pageKey: any) => {
		let page = data.query.pages[pageKey];
		if (page.imageinfo) {
			page.imageinfo.forEach((imgInfo: any) => {
				foundUrl = imgInfo.url;
			});
		}
	});

	STTApi.wikiImages.put({
		fileName: fileName,
		url: foundUrl,
		lastQueried: Date.now()
	});

	if (foundUrl) {
		return { id, url: foundUrl };
	}
	else {
		// the Wiki doesn't have this image yet, or it was named in a non-standard way
		//console.info('Caching the fact that ' + fileName + ' is not available in the wiki yet');
		throw new Error('The Wiki doesn\'t have an image yet for ' + fileName);
	}
}

export class WikiImageProvider implements ImageProvider {
	private _imageCache: ImageCache;

	constructor(imageCache: ImageCache) {
		this._imageCache = imageCache;
	}
	getCrewImageUrl(crew: CrewImageData, fullBody: boolean): Promise<FoundResult<CrewImageData>> {
		let fileName = crew.name.split(' ').join('_') + (fullBody ? '' : '_Head') + '.png';
		return getWikiImageUrl(fileName, crew, this._imageCache.formatUrl(fullBody ? crew.full_body.file : crew.portrait.file));
	}

	getShipImageUrl(ship: ShipDTO): Promise<FoundResult<string>> {
		let fileName = ship.name.split(' ').join('_').split('.').join('').split('\'').join('') + '.png';
		return getWikiImageUrl(fileName, ship.name, this._imageCache.formatUrl(ship.icon.file));
	}

	getItemImageUrl(item: ItemImageData, id: number): Promise<FoundResult<number>> {
		let fileName : string = item.name;
		//HACK: for particular images that the wiki has as nonstandard names
		if (item.symbol === 'energy' && item.type === 3) {
			fileName = "Chroniton_icon.png";
		}
		else {
			if (item.type === 2) {
				fileName += '.png';
			}
			else {
				fileName += CONFIG.RARITIES[item.rarity].name + '.png';
			}
			fileName = fileName.replace(/[ ']/g, '');
		}
		return getWikiImageUrl(fileName, id, this._imageCache.formatUrl(item.icon.file));
	}

	getFactionImageUrl(faction: FactionDTO, id: number): Promise<FoundResult<number>> {
		let fileName = 'Icon' + faction.name.split(' ').join('') + '.png';
		return getWikiImageUrl(fileName, id, this._imageCache.formatUrl(faction.icon.file));
	}

	getSprite(assetName: string, spriteName: string, id: string): Promise<FoundResult<string>> {
		return Promise.reject('Not implemented');
	}

	getImageUrl<T>(iconFile: string, id: T): Promise<FoundResult<T>> {
		let fileName = iconFile + '.png';
		return getWikiImageUrl(fileName, id);
	}

	getSpriteCached(assetName: string, spriteName: string): string {
		return '';
	}
}

export class ImageProviderChain implements ImageProvider {
	imageCache: ImageCache;
	base: ImageProvider;
	ext?: ImageProvider;

	constructor(cache: ImageCache, base: ImageProvider, ext?: ImageProvider) {
		this.imageCache = cache;
		this.base = base;
		this.ext = ext;
	}

	async getSprite(assetName: string, spriteName: string, id: string): Promise<FoundResult<string>> {
		let result = await this.base.getSprite(assetName, spriteName, id);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getSprite(assetName, spriteName, id);
		}
		return result;
	}

	async getImageUrl<T>(iconFile: string, id: T): Promise<FoundResult<T>> {
		if (!iconFile) {
			return { id, url: undefined };
		}
		let cachedUrl = await this.imageCache.getImage(iconFile);
		if (cachedUrl) {
			return { id, url: cachedUrl };
		}

		let result = await this.base.getImageUrl(iconFile, id);
		if (this.ext && (!result.url || result.url === '')) {
			result = await this.ext.getImageUrl(iconFile, id);
		}

		if (result && result.url) {
			//TODO: get raw bitmap and save to the cache here
			//this.imageCache.saveImage(iconFile, rawBitmap);
		}
		return result;
	}

	getSpriteCached(assetName: string, spriteName: string): string {
		return this.imageCache.getCached(((assetName.length > 0) ? (assetName + '_') : '') + spriteName);
	}
}
