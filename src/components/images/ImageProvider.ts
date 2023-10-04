import { ImageDataDTO } from "../../api/DTO21";

export interface FoundResult<T> {
	id: T; // value supplied when a request is made
	url: string | undefined;
}

export interface IBitmap {
	width: number;
	height: number;
	data: Uint8Array;
}

export interface ImageCache {
	getImage(url: string): Promise<string|undefined>;
	saveImage(url: string, data: IBitmap): Promise<string>;
	getCached(url: string): string;
	formatUrl(url: string) : string;
}

// An interface to union the various DTOs that can define crew images, including CrewData, CrewAvatarDTO, and RewardDTO
export interface CrewImageData {
	full_body: ImageDataDTO;
	portrait: ImageDataDTO;
	name: string;
}

export interface ItemImageData {
	name: string;
	icon: ImageDataDTO;
	symbol: string;
	type: number;
	rarity: number;
}

export interface ImageProvider {
	getSprite(assetName: string, spriteName: string, id: string): Promise<FoundResult<string>>;
	getImageUrl<T>(iconFile: string, id: T): Promise<FoundResult<T>>;
	getSpriteCached(assetName: string, spriteName: string): string;
}
