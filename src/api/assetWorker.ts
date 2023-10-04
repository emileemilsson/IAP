const ctx: Worker = self as any;

import { parseAssetBundle } from './unitiyfs-asset-parser';

function parseFromBundle(data: any): any {
    let assetBundle = undefined;
    try {
        assetBundle = parseAssetBundle(new Uint8Array(data.buffer));
    } catch (err) {
        console.error('Failed to parse an image out of bundle '+data.label+': ' + err);
        return [];
    }
    if (!assetBundle || !assetBundle.imageBitmap) {
        console.error('Failed to parse an image out of bundle ' + data.label);
        return [];
    }
    else {
        if (data.assetName && data.assetName.length > 0) {
            if (!assetBundle || !assetBundle.sprites) {
                console.error('Failed to parse a sprite out of bundle ' + data.label);
                return [];
            }

            let sprite = assetBundle.sprites.find((sprite: any) => sprite.spriteName === data.spriteName);
            if (!sprite) {
                console.error('Sprite ' + data.label +' not found!');
                return [];
            }
            return sprite['spriteBitmap'];
        }
        else {
            return assetBundle.imageBitmap;
        }
    }
}

ctx.addEventListener('message', (message: any) => {
    let result = parseFromBundle(message.data);

    if (result && result.data && result.data.length > 0) {
        ctx.postMessage(result, [result.data.buffer]);
    }
    else {
        ctx.postMessage(result);
    }

    // close this worker
    self.close();
});