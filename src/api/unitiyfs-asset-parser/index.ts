import { parseAssetBundleInternal } from './index_js';

export interface Sprite {
    spriteName: string;
    spriteBitmap: {
        data: Buffer;
        width: number;
        height: number;
    };
}

export interface ParseResults {
    imageName?: string;
    imageBitmap?: {
        data: Buffer;
        width: number;
        height: number;
    };
    sprites?: Array<Sprite>;
    assetBundleManifest?: any;
}

export function parseAssetBundle(data: Uint8Array): ParseResults | undefined {
	return parseAssetBundleInternal(data, false);
}

export function parseAssetBundleManifest(data: Uint8Array): ParseResults | undefined {
	return parseAssetBundleInternal(data, true);
}
