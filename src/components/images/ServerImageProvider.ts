import STTApi, { CONFIG }  from '../../api';
import { ImageDataDTO } from '../../api/DTO';
import { CrewImageData, ImageProvider, FoundResult, ItemImageData } from './ImageProvider';

export class ServerImageProvider implements ImageProvider {
    _baseURLAsset: string;
    _cachedAssets: Set<string>;
    _serverURL: string;

    constructor(serverURL: string) {
        this._serverURL = serverURL;
        this._baseURLAsset = this._serverURL + 'assets/';

        this._cachedAssets = new Set();

        this.fillCache();
    }

    async fillCache() {
        let assetList = await STTApi.networkHelper.get(this._serverURL + 'asset/list', { dummy: true });
        this._cachedAssets = new Set(assetList);
    }

    formatUrl(url: string): string {
        let imageName = url.replace(new RegExp('/', 'g'), '_') + '.png';
        imageName = imageName.startsWith('_') ? imageName.substr(1) : imageName;

        return imageName;
    }

    internalGetCached(url: string): string {
        if (this._cachedAssets.has(this.formatUrl(url))) {
            return this._baseURLAsset + this.formatUrl(url);
        } else {
            return '';
        }
    }

    getSpriteCached(assetName: string, spriteName: string): string {
        if (!assetName) {
            return this.internalGetCached(spriteName);
        }

        return this.internalGetCached(((assetName.length > 0) ? (assetName + '_') : '') + spriteName);
    }

    async getSprite(assetName: string, spriteName: string, id: string): Promise<FoundResult<string>> {
        let cachedUrl = this.getSpriteCached(assetName, spriteName);
        if (cachedUrl) {
            return { id, url: cachedUrl };
        }

        let assetUrl = await STTApi.networkHelper.get(this._serverURL + 'asset/get', {
            "client_platform": CONFIG.CLIENT_PLATFORM,
            "client_version": CONFIG.CLIENT_VERSION,
            "asset_server": STTApi.serverConfig!.config.asset_server,
            "asset_bundle_version": STTApi.serverConfig!.config.asset_bundle_version,
            "asset_file": assetName,
            "sprite_name": spriteName
        }, false);

        this._cachedAssets.add(assetUrl);
        return { id, url: this._baseURLAsset + assetUrl };
    }

    async getImageUrl<T>(iconFile: string, id: T): Promise<FoundResult<T>> {
        if (!iconFile) {
            return { id, url: undefined};
        }
        let cachedUrl = this.internalGetCached(iconFile);
        if (cachedUrl) {
            return { id, url: cachedUrl };
        }

        //HACK: ignore server image fetch until asset bundle extraction is fixed
        // if (true) {
        //     return { id, url: undefined };
        // }

        let assetUrl = await STTApi.networkHelper.get(this._serverURL + 'asset/get', {
            "client_platform": CONFIG.CLIENT_PLATFORM,
            "client_version": CONFIG.CLIENT_VERSION,
            "asset_server": STTApi.serverConfig!.config.asset_server,
            "asset_bundle_version": STTApi.serverConfig!.config.asset_bundle_version,
            "asset_file": iconFile
        }, false);

        this._cachedAssets.add(assetUrl);
        return { id, url: this._baseURLAsset + assetUrl };
    }
}
