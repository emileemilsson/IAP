import STTApi from '../../api';
import { CONFIG } from '../../api';

export class ServerImageProvider {
    _baseURLAsset;
    _cachedAssets;
    _serverURL;

    constructor(serverURL) {
        this._serverURL = serverURL;
        this._baseURLAsset = this._serverURL + 'assets/';

        this._cachedAssets = new Set();

        this.fillCache();
    }

    async fillCache() {
        let assetList = await STTApi.networkHelper.get(/*this._serverURL +*/ 'asset/list', { dummy: true });
        this._cachedAssets = new Set(assetList);
    }

    formatUrl(url) {
        let imageName = url.replace(new RegExp('/', 'g'), '_') + '.png';
        imageName = imageName.startsWith('_') ? imageName.substr(1) : imageName;

        return imageName;
	}

    internalGetCached(url) {
        if (this._cachedAssets.has(this.formatUrl(url))) {
            return this._baseURLAsset + this.formatUrl(url);
        } else {
            return '';
        }
    }

    getSpriteCached(assetName, spriteName) {
        if (!assetName) {
            return this.internalGetCached(spriteName);
        }

        return this.internalGetCached(((assetName.length > 0) ? (assetName + '_') : '') + spriteName);
    }

    async getSprite(assetName, spriteName, id) {
        let cachedUrl = this.getSpriteCached(assetName, spriteName);
        if (cachedUrl) {
            return { id, url: cachedUrl };
        }

        let assetUrl = await STTApi.networkHelper.get(this._serverURL + 'asset/get', {
            "client_platform": CONFIG.CLIENT_PLATFORM,
            "client_version": CONFIG.CLIENT_VERSION,
            "asset_server": STTApi.serverConfig.config.asset_server,
            "asset_bundle_version": STTApi.serverConfig.config.asset_bundle_version,
            "asset_file": assetName,
            "sprite_name": spriteName
        }, false);

        this._cachedAssets.add(assetUrl);
        return { id, url: this._baseURLAsset + assetUrl };
    }

    async getImageUrl(iconFile, id) {
        if (!iconFile) {
            return { id: null, url: null};
        }
        let cachedUrl = this.internalGetCached(iconFile);
        if (cachedUrl) {
            return { id, url: cachedUrl };
        }

        let assetUrl = await STTApi.networkHelper.get(this._serverURL + 'asset/get', {
            "client_platform": CONFIG.CLIENT_PLATFORM,
            "client_version": CONFIG.CLIENT_VERSION,
            "asset_server": STTApi.serverConfig.config.asset_server,
            "asset_bundle_version": STTApi.serverConfig.config.asset_bundle_version,
            "asset_file": iconFile
        }, false);

        this._cachedAssets.add(assetUrl);
        return { id, url: this._baseURLAsset + assetUrl };
    }
}