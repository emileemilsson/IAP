import STTApi from "../../api/index";
import { FactionDTO } from "../../api/DTO21";

export function refreshAllFactions(): Promise<any> {
    return STTApi.executeGetRequestWithUpdates("character/refresh_all_factions");
}

export async function loadFactionStore(faction: FactionDTO): Promise<void> {
    let data = await STTApi.executeGetRequestWithUpdates("commerce/store_layout_v2/" + faction.shop_layout);

    faction.storeItems = data[0].grids.map((grid: any) => grid.primary_content[0]);
}
