import STTApi from "../../api/index";
import { ItemData } from "../../api/DTO";

export function replicatorCurrencyCost(archetypeType: number, rarity: number): number {
    return STTApi.platformConfig!.config.replicator_config.currency_costs[rarity].amount;
}

export function replicatorFuelCost(archetypeType: number, rarity: number): number | undefined {
    let replicatorFuel = STTApi.platformConfig!.config.replicator_config.fuel_costs.find((replicatorFuel) => (replicatorFuel.item_type === archetypeType) && (replicatorFuel.rarity === rarity));
    return replicatorFuel ? replicatorFuel.fuel : undefined;
}

export function canReplicate(archetypeId: number): boolean {
    return STTApi.platformConfig!.config.replicator_config.target_blacklist.indexOf(archetypeId) === -1;
}

export function replicatorFuelValue(itemType: number, itemRarity: number): number {
    let replicatorFuel = STTApi.platformConfig!.config.replicator_config.fuel_values.find((replicatorFuel) => (replicatorFuel.item_type === itemType) && (replicatorFuel.rarity === itemRarity));
    return replicatorFuel!.fuel;
}

export function canUseAsFuel(itemId: number): boolean {
    return STTApi.platformConfig!.config.replicator_config.fuel_blacklist.indexOf(itemId) === -1;
}

export type ReplicatorFuel = {
    archetype_id: number;
    quantity: number;
}

export async function replicate(targetArchetypeId: number, fuel: ReplicatorFuel[]): Promise<any> {
    let params: any = { id: targetArchetypeId };

    fuel.forEach(f => {
        params[`fuels[${f.archetype_id}]`] = f.quantity;
    });

    let data = await STTApi.executePostRequest("item/replicate", params);

    await STTApi.applyUpdates(data);
}

export function computeExtraSchematics() : ItemData[] {
    let playerSchematics = STTApi.items.filter(item => item.type === 8);

    let fuellist: ItemData[] = [];
    STTApi.ships.forEach(ship => {
        if (ship.level === ship.max_level) {
            const playerSchematic = playerSchematics.find(playerSchematic => playerSchematic.archetype_id === ship.schematic_id);
            if (playerSchematic) {
                fuellist.push(playerSchematic);
            }
        }
    });
    return fuellist;
}

export function computeExtraItems() : ItemData[] {
    // let equipmentAlreadyOnCrew = new Set();
    // STTApi.roster.forEach(crew => {
    //     if (crew.buyback) {
    //         return;
    //     }

    //     // Comment this line if we want to be more aggressive (with potentially more false positives for in-progress crew)
    //     if (crew.level < 100) {
    //         return;
    //     }

    //     let lastEquipmentLevel = crew.level;
    //     for (let equipment of crew.equipment_slots) {
    //         if (!equipment.have) {
    //             lastEquipmentLevel = equipment.level;
    //         }
    //     }

    //     let feCrew = STTApi.allcrew.find(c => c.symbol === crew.symbol);
    //     if (feCrew) {
    //         feCrew.equipment_slots.forEach(equipment => {
    //             if (equipment.level < lastEquipmentLevel) {
    //                 equipmentAlreadyOnCrew.add(equipment.archetype);
    //             }
    //         });
    //     }
    // });

    // return STTApi.items.filter(
    //     item => equipmentAlreadyOnCrew.has(item.archetype_id) && item.quantity === 1 && item.rarity > 1
    // );

    return STTApi.items.filter(item => item.type === 2 && (item.name.includes("'s ") || item.name.includes("’s ")));
}
