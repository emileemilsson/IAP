import STTApi, { CONFIG } from './index';
import { CrewData, PotentialRewardDTO, ItemArchetypeDTO, MissionData, MissionQuestDTO, FactionDTO, MissionQuestMasteryLevelDTO, ItemData, ItemDTO, RewardDTO, ItemDataSource } from './DTO21';

export function fixupAllCrewIds() : void {
	// Now replace the ids with proper ones
	STTApi.allcrew.forEach((crew: CrewData) => {
		(crew.equipment_slots || []).forEach((es) => {
			let acached = (crew.archetypes || []).find((a) => a.id === es.archetype);
			if (!acached) {
				console.warn(`Something went wrong looking for equipment '${es.archetype}' of '${crew.name}'`);
				return;
			}
			let a = STTApi.itemArchetypeCache.archetypes.find((a) => a.symbol === acached.symbol);
			if (a) {
				//console.log(`For ${crew.name} at level ${es.level} updating ${es.symbol} from ${es.archetype} to ${a.id}`);
				es.archetype = a.id;
			} else {
				console.warn(`Something went wrong looking for equipment '${es.symbol}'`);
				es.archetype = 0;
			}
		});
	});
}

export function getMissionCost(questId: number, mastery_level: number) : number | undefined {
	for (let mission of STTApi.missions) {
		let q = mission.quests.find(q => q.id === questId);
		if (q) {
			if (q.locked || (q.mastery_levels[mastery_level].progress.goal_progress !== q.mastery_levels[mastery_level].progress.goals)) {
				return undefined;
			}

			let raw = q.mastery_levels[mastery_level].energy_cost;
			let sp = STTApi.playerData.character.stimpack;
			if (sp) {
				raw *= 1 - (sp.energy_discount / 100);
			}
			return Math.ceil(raw);
		}
	}

	return undefined;
}

export interface MissionCostDetails {
	mission?: MissionData,
	quest?: MissionQuestDTO,
	questMastery?: MissionQuestMasteryLevelDTO,
	cost?: number
}

export function getMissionCostDetails(questId: number, mastery_level: number): MissionCostDetails {
	for (let mission of STTApi.missions) {
		let quest = mission.quests.find(q => q.id === questId);
		if (quest) {
			let questMastery = quest.mastery_levels[mastery_level];
			if (quest.locked || !questMastery || (questMastery.progress.goal_progress !== questMastery.progress.goals)) {
				return { mission, quest, questMastery };
			}

			let raw = questMastery.energy_cost;
			let sp = STTApi.playerData.character.stimpack;
			if (sp) {
				raw *= 1 - (sp.energy_discount / 100);
			}
			return { mission, quest, questMastery, cost: Math.ceil(raw)};
		}
	}

	return { };
}

export async function loadFullTree(onProgress: (description: string, subDesc?: string) => void, recursing: boolean): Promise<void> {
	let mapEquipment: Set<number> = new Set();
	let missingEquipment: number[] = [];

	// Search for all equipment assignable to the crew at all levels
	// This was a terrible idea; since the data is crowdsourced, it could come from outdated recipe trees and introduce cycles in the graph; data from STTApi.allcrew is not to be trusted

	let allCrewEquip: Set<string> = new Set();
	STTApi.allcrew.forEach((crew) => {
		crew.equipment_slots.forEach((es) => {
			let a = crew.archetypes!.find((a) => a.id === es.archetype);

			if (a) {
				allCrewEquip.add(a.symbol);
				es.symbol = a.symbol;
			}
		});
	});

	STTApi.itemArchetypeCache.archetypes.forEach((equipment) => {
		mapEquipment.add(equipment.id);
		allCrewEquip.delete(equipment.symbol);
	});

	// Have we already cached equipment details for the current digest (since the last recipe update)?
	let entry = await STTApi.equipmentCache
		.where('digest')
		.equals(STTApi.serverConfig!.config.craft_config.recipe_tree.digest)
		.first();

	if (entry) {
		// Merge the cached equipment, since the recipe tree didn't change since our last load
		entry.archetypeCache.forEach((cacheEntry) => {
			if (!mapEquipment.has(cacheEntry.id)) {
				STTApi.itemArchetypeCache.archetypes.push(cacheEntry);
				mapEquipment.add(cacheEntry.id);
			}

			allCrewEquip.delete(cacheEntry.symbol);
		});
	}

	// Load the description for all crew equipment
	let allcrewData = Array.from(allCrewEquip.values());
	while (allcrewData.length > 0) {
		onProgress('Loading all crew equipment...', `(${allcrewData.length} remaining)`);
		let archetypesAll = await loadItemsDescription(allcrewData.splice(0, 20));
		console.log(`Loaded ${archetypesAll.length}, remaining ${allcrewData.length}`);
		if (archetypesAll.length > 0) {
			STTApi.itemArchetypeCache.archetypes = STTApi.itemArchetypeCache.archetypes.concat(archetypesAll);
		}
	}

	if (!recursing) {
		fixupAllCrewIds();
	}

	// Search for all equipment in the recipe tree
	STTApi.itemArchetypeCache.archetypes.forEach((equipment) => {
		if (equipment.recipe && equipment.recipe.demands && equipment.recipe.demands.length > 0) {
			equipment.recipe.demands.forEach((item) => {
				if (!mapEquipment.has(item.archetype_id)) {
					missingEquipment.push(item.archetype_id);
				}
			});
		}
	});

	// Search for all equipment currently assigned to crew
	STTApi.roster.forEach((crew: CrewData) => {
		crew.equipment_slots.forEach(es => {
			if (!mapEquipment.has(es.archetype)) {
				missingEquipment.push(es.archetype);
			}
		});
	});

	if (missingEquipment.length === 0) {
		// We're done loading, let's cache the current list, to save on future loading time
		await STTApi.equipmentCache.put({
			digest: STTApi.serverConfig!.config.craft_config.recipe_tree.digest,
			archetypeCache: STTApi.itemArchetypeCache.archetypes
		});

		return;
	}

	onProgress('Loading equipment...', `(${missingEquipment.length} remaining)`);

	// Load the description for the missing equipment
	let archetypes = await loadItemsDescription(missingEquipment.slice(0, 20));

	if (archetypes.length > 0) {
		STTApi.itemArchetypeCache.archetypes = STTApi.itemArchetypeCache.archetypes.concat(archetypes);
		console.log(`Loaded ${archetypes.length} archetypes; recursing`);
		return loadFullTree(onProgress, true);
	}

	// We're done loading, let's cache the current list, to save on future loading time
	await STTApi.equipmentCache.put({
		digest: STTApi.serverConfig!.config.craft_config.recipe_tree.digest,
		archetypeCache: STTApi.itemArchetypeCache.archetypes
	});
}

async function loadItemsDescription(ids: number[] | string[]): Promise<ItemArchetypeDTO[]> {
	let archetypes: ItemArchetypeDTO[] = [];
	try {
		// Load the description for the missing equipment
		let data = await STTApi.executeGetRequest('item/description', { ids });

		if (data.item_archetype_cache && data.item_archetype_cache.archetypes) {
			archetypes = data.item_archetype_cache.archetypes;
		}
	} catch (error) {
		// Some equipment is causing the server to choke, time to binary search the culprit
		if (ids.length === 1) {
			console.error(`The description for item ${ids[0]} fails to load.`);
		} else {
			let leftSide = ids.splice(0, Math.ceil(ids.length / 2));

			let leftArchetypes = await loadItemsDescription(leftSide);
			let rightArchetypes = await loadItemsDescription(ids);

			archetypes = leftArchetypes.concat(rightArchetypes);
		}
	}

	return archetypes;
}

function scanRewards(
	potential_rewards: (PotentialRewardDTO | RewardDTO)[] | undefined,
	visitor: (reward: RewardDTO) => void
) {
	if (!potential_rewards)
		return;
	potential_rewards.forEach(reward => {
		if ((reward as PotentialRewardDTO).potential_rewards) {
			scanRewards((reward as PotentialRewardDTO).potential_rewards, visitor);
		} else {
			visitor(reward as RewardDTO);
		}
	});
};

export function buildItemData(dtos: ItemDTO[]) : ItemData[] {
	let items : ItemData[] = [];

	let factionNameItemIds = new Map<string, Set<number>>();
	STTApi.playerData.character.factions.forEach(f => {
		factionNameItemIds.set(f.name, new Set());
		scanRewards(f.shuttle_mission_rewards,
			(reward) => {
				//if (reward.type === 2) {
					factionNameItemIds.get(f.name)!.add(reward.id);
				//}
			}
		);
	});

	const cadetable = STTApi.getEquipmentManager().getCadetableItems();
	for (const itemDTO of dtos) {
		try {
			let item : ItemData = {
				...itemDTO,
				factions: [],
				//typeName = itemDTO.icon.file.replace("/items", "").split("/")[1];
				//symbol2 = itemDTO.icon.file.replace("/items", "").split("/")[2];
				sources: []
			};

			// Push onto items before trying things that might throw so it can be partially complete
			items.push(item);

			//NOTE: this used to overwrite the DTO's symbol; is it needed?
			//itemDTO.symbol = itemDTO.icon.file.replace("/items", "").split("/")[2];

			item.cadetable = '';
			const cadetSources = cadetable.get(item.archetype_id);
			if (cadetSources) {
				cadetSources.forEach(v => {
					let name = v.mission.episode_title;
					let mastery = v.masteryLevel;

					let questName = v.quest.action;
					let questIndex = null;
					v.mission.quests.forEach((q, i) => {
						if (q.id === v.quest.id)
							questIndex = i + 1;
					});

					if (item.cadetable)
						item.cadetable += ' | ';
					item.cadetable += name + ' : ' + questIndex + ' : ' + questName + ' : ' + CONFIG.MASTERY_LEVELS[mastery].name;

					// const costDetails = getMissionCostDetails(v.quest.id, mastery);
					item.sources.push({
						chance: 0,
						quotient: 0,
						title: name + ' #' + questIndex + ' ' + CONFIG.MASTERY_LEVELS[mastery].name + ' (' + questName + ')',
							// + '[' + entry.chance_grade + '/5 @ ' +
							// costDetails.cost + ' Chrons (q=' + (Math.round(entry.energy_quotient * 100) / 100) + ')]',
						type: 'cadet',
						mission: v.mission,
						quest: v.quest,
					});
				});
			}

			let iter = factionNameItemIds.entries();
			for (let n = iter.next(); !n.done; n = iter.next()) {
				let e = n.value;
				if (e[1].has(item.archetype_id)) {
					item.factions.push(e[0]);
				}
				n = iter.next();
			}

			const archetype = STTApi.itemArchetypeCache.archetypes.find(a => a.id === item.archetype_id);
			//TODO: what does it mean if there is no archetype?
			if (archetype) {
				const missions = archetype.item_sources.filter(e => e.type === 0 || e.type === 1 || e.type === 2);
				const sources : ItemDataSource[] = missions.map((entry, idx) => {
					const chance = entry.chance_grade / 5;
					const quotient = entry.energy_quotient;
					if (entry.type == 1) {
						return {
							chance,
							quotient: 0,
							title: entry.name,
							type: 'faction'
						};
					}
					const costDetails = getMissionCostDetails(entry.id, entry.mastery);
					let title = '';
					if (costDetails.mission && costDetails.quest && costDetails.cost && costDetails.questMastery) {
						const qoff = costDetails.mission.quests.indexOf(costDetails.quest) + 1;
						const missionTitle = costDetails.mission.description.length > costDetails.mission.episode_title.length ?
							costDetails.mission.episode_title : costDetails.mission.description;
						title = missionTitle + ' #' + qoff + ' '+CONFIG.MASTERY_LEVELS[costDetails.questMastery.id].name+' (' + costDetails.quest.name + ')[' + entry.chance_grade + '/5 @ ' + costDetails.cost + ' Chrons (q=' + (Math.round(entry.energy_quotient * 100) / 100) + ')]';
					}
					return {
						...costDetails,
						chance,
						quotient,
						title,
						type: entry.type === 0 ? 'dispute' : 'ship'
					};
				});
				const filtered = sources.filter(s => s.title !== '');
				filtered.forEach(src => item.sources.push(src));
			}
			//console.log('Item: ' + item.name + ' rarity:' + item.rarity + ' sym:' + item.symbol + ' aid:' + item.archetype_id + ' iid:' + item.id
			// + (' srcs:' + item.sources.map((src, idx, all) => src.title +'-' + src.type + (idx === all.length - 1 ? '' : ', '))));
		}
		catch (e) {
			console.error(e);
		}
	}

	// Now iterate through all missions and quests and collect rewards into the sources structure that are missing from
	// the archetype
	STTApi.missions.forEach(m => {
		m.quests.forEach((q, qi) => {
			q.mastery_levels.forEach((ml, mli) => {
				scanRewards(ml.rewards, reward => {
					const item = items.find(itm => itm.archetype_id === reward.id);
					if (!item) {
						return;
					}
					// Only capture sources for equipment and components
					if (item.type !== 2 && item.type !== 3) {
						return;
					}
					let src = item.sources.find(src => src.mission?.id === m.id && src.quest?.id === q.id);
					if (!src) {
						let type = '';
						let title = m.episode_title + ' #' + (qi+1) + ' ' + CONFIG.MASTERY_LEVELS[mli].name + ' (' + q.name + ')';
						if (q.cadet) {
							type = 'cadet';
						} else if (q.quest_type === 'ShipBattleQuest') {
							type = 'ship';
							const missionTitle = m.episode > 0 ? 'Episode ' + m.episode : m.episode_title;
							title = missionTitle + ' #' + (qi+1) + ' '+CONFIG.MASTERY_LEVELS[mli].name+' (' + q.name + ')';
						} else if (q.quest_type === 'ConflictQuest') {
							type = 'dispute';
							const missionTitle = m.episode > 0 ? 'Episode ' + m.episode : m.episode_title;
							title = missionTitle + ' #' + (qi+1) + ' '+CONFIG.MASTERY_LEVELS[mli].name+' (' + q.name + ')';
						} else {
							console.log("not found");
						}
						src = {
							chance: 0,
							quotient: 0,
							title,
							type,
							quest: q,
							mission: m,
							questMastery: ml,
						};
						item.sources.push(src);
					}
				})
			});
		});
	});

	return items;
}

export interface CadetItemSource {
	quest: MissionQuestDTO;
	mission: MissionData;
	masteryLevel: number;
}

export interface FactionStoreItemSource {
	cost_currency: string;
	cost_amount: number;
	faction: FactionDTO;
}

export interface EquipNeedFilter {
	onlyNeeded: boolean;
	onlyFaction: boolean;
	cadetable: boolean;
	allLevels: boolean;
	userText: string | undefined;
}

export interface EquipNeedCount {
	crew: CrewData;
	count: number;
}

export interface EquipNeed {
	equipment: ItemArchetypeDTO;
	needed: number;
	have: number;
	cadetSources: CadetItemSource[];
	factionSources: FactionStoreItemSource[];
	counts: Map<number, EquipNeedCount>;
	isDisputeMissionObtainable: boolean;
	isShipBattleObtainable: boolean;
	isFactionObtainable: boolean;
	isCadetable: boolean;
}

export interface UnparsedEquipment {
	archetype: number;
	need: number;
	crew: CrewData;
}

export class NeededEquipmentClass {
	private _cadetableItems: Map<number, CadetItemSource[]>;
	private _factionableItems: Map<number, FactionStoreItemSource[]>;

	constructor() {
		this._cadetableItems = new Map<number, CadetItemSource[]>();
		this._factionableItems = new Map<number, FactionStoreItemSource[]>();
	}

	filterNeededEquipment(filters: EquipNeedFilter, limitCrew: number[]): EquipNeed[] {
		this._getCadetableItems();
		this._getFactionableItems();
		const filteredCrew = this._getFilteredCrew(filters, limitCrew);
		const neededEquipment = this._getNeededEquipment(filteredCrew, filters);
		return neededEquipment;
	}

	filterNeededEquipmentFromList(unparsedEquipment: UnparsedEquipment[]): EquipNeed[] {
        let mapUnowned = Array.from(this._calculateNeeds(unparsedEquipment, STTApi.itemArchetypeCache.archetypes).values());
        return mapUnowned.sort((a,b) => a.have - b.have);
    }

	private _getFilteredCrew(filters: EquipNeedFilter, limitCrew: number[]): CrewData[] {
		if (limitCrew.length === 0) {
			// filter out `crew.buyback` by default
			return STTApi.roster.filter((c: CrewData) => !c.buyback);
		} else {
			let selectedCrew: CrewData[] = [];
			limitCrew.forEach((id: number) => {
				let crew = STTApi.roster.find((c: CrewData) => c.id === id);
				if (!crew) {
					crew = STTApi.allcrew.find((c: CrewData) => c.id === id);
				}

				if (crew) {
					selectedCrew.push(crew);
				}
			});

			return selectedCrew;
		}
	}

	private _getFactionableItems() {
		if (this._factionableItems.size === 0) {
			for (let faction of STTApi.playerData.character.factions) {
				for (let storeItem of (faction.storeItems || [])) {
					if (
						storeItem.offer.game_item.type === 2 &&
						(storeItem.offer.game_item.item_type === 2 || storeItem.offer.game_item.item_type === 3)
					) {
						let item_id = storeItem.offer.game_item.id;

						let info: FactionStoreItemSource = {
							cost_currency: storeItem.offer.cost.currency,
							cost_amount: storeItem.offer.cost.amount,
							faction: faction
						};

						if (this._factionableItems!.has(item_id)) {
							this._factionableItems!.get(item_id)!.push(info);
						} else {
							this._factionableItems!.set(item_id, [info]);
						}
					}
				}
			}
		}
	}

	public getCadetableItems() {
		this._getCadetableItems();
		return this._cadetableItems;
	}

	public getFactionableItems() {
		this._getFactionableItems();
		return this._factionableItems;
	}

	private _getCadetableItems() {
		if (this._cadetableItems.size === 0) {
			//Advanced Cadet Challenges offer the same rewards as Standard ones, so filter them to avoid duplicates
			let cadetMissions = STTApi.missions
				.filter((mission) => mission.quests.some((quest) => quest.cadet))
				.filter((mission) => mission.episode_title.indexOf('Adv') === -1);

			for (let cadetMission of cadetMissions) {
				for (let quest of cadetMission.quests) {
					for (let masteryLevel of quest.mastery_levels) {
						masteryLevel.rewards
							.filter((r) => r.type === 0)
							.forEach((reward) => {
								(reward as PotentialRewardDTO).potential_rewards.forEach((item) => {
									//let archItem = STTApi.itemArchetypeCache.archetypes.find(arch => arch.id === item.id);
									let info: CadetItemSource = {
										quest: quest,
										mission: cadetMission,
										masteryLevel: masteryLevel.id
									};

									if (this._cadetableItems!.has(item.id)) {
										this._cadetableItems!.get(item.id)!.push(info);
									} else {
										this._cadetableItems!.set(item.id, [info]);
									}
								});
							});
					}
				}
			}
		}
	}

	private _mergeMapUnowned(target: Map<number, EquipNeed>, source: Map<number, EquipNeed>) {
		for (let archetype of source.keys()) {
			if (target.has(archetype)) {
				target.get(archetype)!.needed += source.get(archetype)!.needed;

				for (let count of source.get(archetype)!.counts.keys()) {
					if (target.get(archetype)!.counts.has(count)) {
						target.get(archetype)!.counts.get(count)!.count += source.get(archetype)!.counts.get(count)!.count;
					} else {
						target.get(archetype)!.counts.set(count, source.get(archetype)!.counts.get(count)!);
					}
				}
			} else {
				target.set(archetype, source.get(archetype)!);
			}
		}

		return target;
	}

	private _calculateNeeds(unparsedEquipment: UnparsedEquipment[], archetypes: ItemArchetypeDTO[]) {
		let mapUnowned: Map<number, EquipNeed> = new Map();
		let mapIncompleteUsed: Map<number, EquipNeed> = new Map();
		// TODO: infinite loop detection, for bad data

		let loopCount = 0;
		while (unparsedEquipment.length > 0) {
			if (loopCount++ > 10000) {
				break;
			}

			let eq = unparsedEquipment.pop()!;
			let equipment = archetypes.find(e => e.id === eq.archetype);

			if (!equipment) {
				console.warn(`This equipment has no recipe and no sources: '${eq.archetype}'`);
			} else if (equipment.recipe && equipment.recipe.demands && equipment.recipe.demands.length > 0) {
				let have = STTApi.items.find((item) => item.archetype_id === eq.archetype);
				// don't have any partially built, queue up to break into pieces
				if (!have || have.quantity <= 0) {
					// Add all children in the recipe to parse on the next loop iteration
					equipment.recipe.demands.forEach((recipeItem) => {
						unparsedEquipment.push({
							archetype: recipeItem.archetype_id,
							need: recipeItem.count * eq.need,
							crew: eq.crew
						});
					});
				} else {
					// see how many are already accounted for
					let found = mapIncompleteUsed.get(eq.archetype);
					if (found) {
						found.needed += eq.need;
					} else {
						found = {
							equipment,
							needed: eq.need - have.quantity,
							have: have.quantity,
							cadetSources: this._cadetableItems.get(equipment.id) || [],
							factionSources: this._factionableItems.get(equipment.id) || [],
							counts: new Map(),
							isDisputeMissionObtainable: false,
							isShipBattleObtainable: false,
							isFactionObtainable: false,
							isCadetable: false
						};

						mapIncompleteUsed.set(eq.archetype, found);
					}

					// if total requirements exceed inventory
					if (found.needed > 0) {
						// how many can be filled for this equipment demand
						let partialNeeded = eq.need;
						// If this new requirement pushed past inventory amount, only need a partial amount equal to the overlap
						if (found.needed < eq.need) {
							partialNeeded = eq.need - found.needed;
						}
						equipment.recipe.demands.forEach((recipeItem) => {
							unparsedEquipment.push({
								archetype: recipeItem.archetype_id,
								need: recipeItem.count * partialNeeded,
								crew: eq.crew
							});
						});
					} else {
						//NOTE: this clause can be removed to avoid zero counts for crew members
						// Track the crew that needs them, but retain zero count (since the item is partially built)
						// in case the intermediate item gets consumed elsewhere
						equipment.recipe.demands.forEach((recipeItem) => {
							unparsedEquipment.push({
								archetype: recipeItem.archetype_id,
								need: 0,
								crew: eq.crew
							});
						});
					}
				}
			} else if ((equipment.item_sources && equipment.item_sources.length > 0) || this._cadetableItems.has(equipment.id)) {
				let found = mapUnowned.get(eq.archetype);
				if (found) {
					found.needed += eq.need;
					let counts = found.counts.get(eq.crew.id);
					if (counts) {
						counts.count += eq.need;
					} else {
						found.counts.set(eq.crew.id, { crew: eq.crew, count: eq.need });
					}
				} else {
					let have = STTApi.items.find((item) => item.archetype_id === eq.archetype);
					let isDisputeMissionObtainable = equipment.item_sources.filter((e) => e.type === 0).length > 0;
					let isShipBattleObtainable = equipment.item_sources.filter((e) => e.type === 2).length > 0;
					let isFactionObtainable = equipment.item_sources.filter((e) => e.type === 1).length > 0;
					let isCadetable = this._cadetableItems.has(equipment.id);
					let counts: Map<number, EquipNeedCount> = new Map();
					counts.set(eq.crew.id, { crew: eq.crew, count: eq.need });

					equipment.item_sources.sort((a, b) => b.energy_quotient - a.energy_quotient);

					mapUnowned.set(eq.archetype, {
						equipment,
						cadetSources: this._cadetableItems.get(equipment.id) || [],
						factionSources: this._factionableItems.get(equipment.id) || [],
						needed: eq.need,
						have: have ? have.quantity : 0,
						counts: counts,
						isDisputeMissionObtainable: isDisputeMissionObtainable,
						isShipBattleObtainable: isShipBattleObtainable,
						isFactionObtainable: isFactionObtainable,
						isCadetable: isCadetable
					});
				}
			}
		}

		return mapUnowned;
	}

	private _getNeededEquipment(filteredCrew: CrewData[], filters: EquipNeedFilter) {
		let unparsedEquipment: UnparsedEquipment[] = [];
		let mapUnowned: Map<number, EquipNeed> = new Map();
		for (let crew of filteredCrew) {
			let lastEquipmentLevel = 1;
			crew.equipment_slots.forEach(equipment => {
				if (!equipment.have) {
					unparsedEquipment.push({ archetype: equipment.archetype, need: 1, crew: crew });
				}

				lastEquipmentLevel = equipment.level;
			});

			if (filters.allLevels && !crew.isExternal) {
				let feCrew = STTApi.allcrew.find(c => c.symbol === crew.symbol);
				if (feCrew) {
					let unparsedEquipmentFE: UnparsedEquipment[] = [];
					feCrew.equipment_slots.forEach(equipment => {
						if (equipment.level > lastEquipmentLevel) {
							unparsedEquipmentFE.push({ archetype: equipment.archetype, need: 1, crew: crew });
						}
					});

					mapUnowned = this._mergeMapUnowned(mapUnowned, this._calculateNeeds(unparsedEquipmentFE, STTApi.itemArchetypeCache.archetypes));
				}
			}
		}

		mapUnowned = this._mergeMapUnowned(mapUnowned, this._calculateNeeds(unparsedEquipment, STTApi.itemArchetypeCache.archetypes));

		// Sort the map by "needed" descending
		let arr = Array.from(mapUnowned.values());
		arr.sort((a, b) => b.needed - a.needed);

		if (filters.onlyNeeded) {
			arr = arr.filter((entry: EquipNeed) => entry.have < entry.needed);
		}

		if (filters.onlyFaction) {
			arr = arr.filter(
				(entry: EquipNeed) => !entry.isDisputeMissionObtainable && !entry.isShipBattleObtainable && entry.isFactionObtainable
			);
		}

		if (filters.cadetable) {
			arr = arr.filter((entry: EquipNeed) => entry.isCadetable);
		}

		if (filters.userText && filters.userText.trim().length > 0) {
			let filterString = filters.userText.toLowerCase();

			arr = arr.filter((entry: EquipNeed) => {
				// if value is (parsed into) a number, filter by entry.equipment.rarity, entry.needed, entry.have, entry.counts{}.count
				let filterInt = parseInt(filterString);
				if (!isNaN(filterInt)) {
					if (entry.equipment.rarity === filterInt) {
						return true;
					}
					if (entry.needed === filterInt) {
						return true;
					}
					if (entry.have === filterInt) {
						return true;
					}
					if (Array.from(entry.counts.values()).some((c: EquipNeedCount) => c.count === filterInt)) {
						return true;
					}
					return false;
				}

				// if string, filter by entry.equipment.name, entry.counts{}.crew.name, entry.equipment.item_sources[].name, cadetableItems{}.name
				if (entry.equipment.name.toLowerCase().includes(filterString)) {
					return true;
				}
				if (Array.from(entry.counts.values()).some((c: EquipNeedCount) => c.crew.name.toLowerCase().includes(filterString))) {
					return true;
				}
				if (entry.equipment.item_sources.some((s) => s.name.toLowerCase().includes(filterString))) {
					return true;
				}
				if (this._cadetableItems.has(entry.equipment.id)) {
					if (
						this._cadetableItems
							.get(entry.equipment.id)!
							.some(
								(c) =>
									c.quest.name.toLowerCase().includes(filterString) || c.mission.episode_title.toLowerCase().includes(filterString)
							)
					) {
						return true;
					}
				}

				return false;
			});
		}

		return arr;
	}
}
