import React from 'react';

import { Item, Image, List, Accordion, Icon, AccordionTitleProps } from 'semantic-ui-react';

import { ItemDisplay } from '../../utils/ItemDisplay';

import STTApi, { CONFIG, RarityStars, getItemDetailsLink } from '../../api';
import { EventDTO, EventGatherPoolAdventureDTO, EVENT_TYPES, ItemArchetypeDTO, ItemData, CrewData, ItemArchetypeDemandDTO } from '../../api/DTO21';
import { EventCrewBonusTable, EventStat } from './EventHelperPage';
import ReactTable, { Column, SortingRule } from 'react-table';
import { MissionCostDetails } from '../../api/EquipmentTools';

interface ItemDemand {
	equipment: ItemArchetypeDTO;
	bestCrewChance: number;
	calcSlot: CalcSlot;
	craftCost: number;
	have: number;
	itemDemands: ItemDemandData[];
}

interface ItemDemandData {
	rd: ItemArchetypeDemandDTO;
	archetype?: ItemArchetypeDTO;
	item?: ItemData;
	item_name?: string;
	item_quantity?: number;
	cost?: number;
}

interface EquipListItem {
	equip: ItemArchetypeDTO;
	have: ItemData | undefined;
	itemDemands: ItemDemandData[];
	bestCrew: BonusCrew[];
}

interface BonusCrew {
	crew: CrewData;
	crew_id: number;
	skills: { [sk:string]:number };
	total: number;
	chance: number;
	text?: string;
	value?: string;
	image?: string;
}

interface CalcSlot {
	bestCrew: BonusCrew[];
	skills: string[];
	type?: string;
}

interface FarmListItem {
	archetype: ItemArchetypeDTO;
	item?: ItemData;
	uses: string;
	sources: (MissionCostDetails & { chance: number; quotient: number; title: string })[]
}

// Compute craft success chance based on formula steepness, challenge rating, etc.
function calcChance(skillValue: number) {
	let midpointOffset = skillValue / STTApi.serverConfig!.config.craft_config.specialist_challenge_rating;
	let val = Math.floor(
		100 /
		(1 +
			Math.exp(
				-STTApi.serverConfig!.config.craft_config.specialist_chance_formula.steepness *
				(midpointOffset - STTApi.serverConfig!.config.craft_config.specialist_chance_formula.midpoint)
				))
		);
	return Math.min(val / 100, STTApi.serverConfig!.config.craft_config.specialist_maximum_success_chance);
	// const cc = STTApi.serverConfig!.config.craft_config;
	// let midpointOffset = skillValue / cc.specialist_challenge_rating;
	// let val = Math.floor(100 / (1 + Math.exp(cc.specialist_chance_formula.steepness * (midpointOffset - cc.specialist_chance_formula.midpoint))));
	// return Math.min(val / 100, cc.specialist_maximum_success_chance);
};

function processArchetype(arch: ItemArchetypeDTO | undefined, bestCrew: BonusCrew[]) : ItemDemand | undefined {
	if (!arch || !arch.recipe || !arch.recipe.jackpot) {
		return undefined;
	}

	let skills = arch.recipe.jackpot.skills;

	let calcSlot: CalcSlot = {
		bestCrew: bestCrew.map(bc => { return {...bc}}),
		skills: []
	};

	if (skills.length === 1) {
		// AND or single
		calcSlot.skills = skills[0].split(',');
		if (calcSlot.skills.length === 1) {
			calcSlot.type = 'SINGLE';
			calcSlot.bestCrew.forEach((c) => {
				c.total = c.skills[calcSlot.skills[0]];
			});
		} else {
			calcSlot.type = 'AND';
			calcSlot.bestCrew.forEach((c) => {
				c.total = Math.floor((c.skills[calcSlot.skills[0]] + c.skills[calcSlot.skills[1]]) / 2);
			});
		}
	} else {
		// OR
		calcSlot.type = 'OR';
		calcSlot.skills = skills;
		calcSlot.bestCrew.forEach((c) => {
			c.total = Math.max(c.skills[calcSlot.skills[0]], c.skills[calcSlot.skills[1]]);
		});
	}

	let seen = new Set<number>();
	calcSlot.bestCrew = calcSlot.bestCrew.filter((c) => c.total > 0).filter((c) => (seen.has(c.crew_id) ? false : seen.add(c.crew_id)));

	calcSlot.bestCrew.forEach(c => c.chance = calcChance(c.total));
	if (arch.recipe.jackpot.trait_bonuses) {
		for (let trait in arch.recipe.jackpot.trait_bonuses) {
			let tv = arch.recipe.jackpot.trait_bonuses[trait];
			calcSlot.bestCrew.forEach(c => {
				if (c.crew.rawTraits.includes(trait)) {
					c.chance += tv;
				}
			});
		}
	}

	calcSlot.bestCrew.sort((a, b) => a.chance - b.chance);
	calcSlot.bestCrew = calcSlot.bestCrew.reverse();

	let bestCrewChance = calcSlot.bestCrew[0].chance;

	calcSlot.bestCrew.forEach((c) => {
		c.text = `${c.crew.name} (${c.total})`;
		c.value = c.crew.symbol;
		c.image = STTApi.imgUrl(c.crew.portrait, undefined); // loads from elsewhere
		c.chance = Math.floor(Math.min(c.chance, 1) * 100);
	});

	bestCrewChance = calcSlot.bestCrew[0].chance;//Math.floor(Math.min(bestCrewChance, 1) * 100);

	let itemDemands: { rd: ItemArchetypeDemandDTO, archetype?: ItemArchetypeDTO, item?: ItemData }[] = [];
	for (let rd of arch.recipe.demands) {
		const item = STTApi.items.find(item => item.archetype_id === rd.archetype_id);
		const archetype = STTApi.itemArchetypeCache.archetypes.find(arch => arch.id === rd.archetype_id);
		itemDemands.push({
			rd,
			archetype,
			item
		});
	}

	let have = STTApi.items.find(item => item.archetype_id === arch!.id);

	let craftCost = 0;
	if (arch.type === 3) {
		craftCost = STTApi.serverConfig!.config.craft_config.cost_by_rarity_for_component[arch.rarity].amount;
	} else if (arch.type === 2) {
		craftCost = STTApi.serverConfig!.config.craft_config.cost_by_rarity_for_equipment[arch.rarity].amount;
	} else {
		console.warn('Equipment of unknown type', arch);
	}

	return {
		equipment: arch,
		bestCrewChance,
		calcSlot,
		craftCost,
		have: have ? have.quantity : 0,
		itemDemands
	};
}

function getRosterWithBonuses(crew_bonuses: { [crew_symbol: string]: number }): BonusCrew[] {
	// TODO: share some of this code with Shuttles
	let sortedRoster: BonusCrew[] = [];
	STTApi.roster.forEach(crew => {
		if (crew.buyback) { // || crew.frozen > 0 || crew.active_id) {
			return;
		}

		let bonus = 1;
		if (crew_bonuses[crew.symbol]) {
			bonus = crew_bonuses[crew.symbol];
		}

		let skills: { [sk: string]: number } = {};
		for (let sk in CONFIG.SKILLS) {
			skills[sk] = crew.skills[sk].core * bonus;
		}

		sortedRoster.push({
			crew,
			crew_id: crew.id,
			skills,
			total: 0,
			chance: 0
		});
	});

	return sortedRoster;
}

export const GalaxyEvent = (props: {
	event: EventDTO;
}) => {
	const [activeIndex, setActiveIndex] = React.useState(-1);
	const [, imageCacheUpdated] = React.useState<string>('');

	let crew_bonuses = [];
	let eventEquip: EquipListItem[] = [];
	let farmList: FarmListItem[] = [];
	let currEvent: EventDTO = props.event;

	if (!props.event ||
		!props.event.content ||
		props.event.content.content_type !== EVENT_TYPES.GATHER ||
		!props.event.content.gather_pools
	) {
		return <span />;
	}

	const adventures = currEvent.content.gather_pools.length > 0 ? currEvent.content.gather_pools[0].adventures : [];
	const rewards = currEvent.content.gather_pools.length > 0 ? currEvent.content.gather_pools[0].rewards : [];

	const bonusCrew: BonusCrew[] = getRosterWithBonuses(currEvent!.content.crew_bonuses!);
	for (let cb in currEvent.content.crew_bonuses!) {
		let avatar = STTApi.getCrewAvatarBySymbol(cb);
		if (!avatar) {
			continue;
		}

		crew_bonuses.push({
			avatar,
			bonus: currEvent.content.crew_bonuses![cb],
			iconUrl: STTApi.imgUrl(avatar.icon, imageCacheUpdated)
		});
	}

	// Look through all archetypes for items that apply to the event (i.e. the ones with jackpot)
	for (let arch of STTApi.itemArchetypeCache.archetypes) {
		if (arch.recipe && arch.recipe.jackpot && arch.recipe.jackpot.trait_bonuses) {
			const demand = processArchetype(arch, [...bonusCrew])!;
			//TODO: re-use demand instead of this additional DTO; ALSO re-use calculation and dont do it more than once
			let itemDemands: ItemDemandData[] = [];
			for (let rd of arch.recipe.demands) {
				let item = STTApi.items.find(item => item.archetype_id === rd.archetype_id);
				let arc = STTApi.itemArchetypeCache.archetypes.find(a => a.id === rd.archetype_id)!;

				itemDemands.push({
					rd,
					archetype: arc,
					item,
					item_name: item ? item.name : arc ? arc.name : '',
					item_quantity: item ? item.quantity : 0,
					cost: item ? (item.sources.length == 0 ? 0 : item.sources.sort((a, b) => b.quotient - a.quotient)[0].quotient) : undefined,
				});
			}

			let have = STTApi.items.find(item => item.archetype_id === arch.id);

			eventEquip.push({
				equip: arch,
				have,
				itemDemands,
				bestCrew: demand.calcSlot.bestCrew,
			});
		}
	}

	let farmingList = new Map<number,string>();
	eventEquip.forEach(e =>
		e.itemDemands.forEach(id => {
			if (farmingList.has(id.rd.archetype_id)) {
				farmingList.set(id.rd.archetype_id, farmingList.get(id.rd.archetype_id)! + ',' + id.rd.count + 'x');
			} else {
				farmingList.set(id.rd.archetype_id, '' + id.rd.count + 'x');
			}
		})
	);

	farmingList.forEach((v, k) => {
		let archetype = STTApi.itemArchetypeCache.archetypes.find(a => a.id === k)!;

		const item = STTApi.items.find(item => item.archetype_id === k)!;
		farmList.push({
			archetype,
			item,
			uses: v,
			sources: item ? (item.sources ?? []) : []
		});
	});

	// TODO: compare with future galaxy events
	let toSave = farmList.map(fl => ({ equipment_id: fl.archetype.id, equipment_symbol: fl.archetype.symbol, uses: fl.uses }));
	//console.log(toSave);

	function _handleClick(titleProps: AccordionTitleProps) {
		const { index } = titleProps;
		//const { activeIndex } = this.state;
		const newIndex = activeIndex === index ? -1 : index as number;

		//this.setState({ activeIndex: newIndex });
		setActiveIndex(newIndex);
	}

	const vpCurr = currEvent.victory_points ?? 0;
	const vpTopThresh = currEvent.threshold_rewards[currEvent.threshold_rewards.length-1].points;
	let rareArchetypeId : number | undefined = undefined;
	//let rareArchetype = undefined;
	let rareTurninCount: number | undefined = undefined;
	{
		const gos = adventures.filter(ad => ad.golden_octopus);
		if (gos.length > 0) {
			const go = gos[0];
			rareArchetypeId = go.demands[0].archetype_id;
			rareTurninCount = go.demands[0].count;
			//rareArchetype = STTApi.itemArchetypeCache.archetypes.find(a => a.id === rareArchetypeId);
		}
	}
	const rareItem = STTApi.items.find(item => item.archetype_id === rareArchetypeId);
	let rareCount = 0;
	if (rareItem) {
		rareCount = rareItem.quantity;
	}

	// VP per turnin of 2 or 3 items
	let vpPerMission = undefined;
	if (rewards.length > 0) {
		vpPerMission = rewards[0].quantity;
	}

	// The two phases have a different turnin schedule for rares; phase 2 starts with 3x3@735
	const vpPerTurninTable : {items: number; count?: number; vp: number}[][] = [[
			{ items: 1, count: 1, vp: 125 },
			{ items: 2, count: 3, vp: 415 },
			{ items: 3, count: 3, vp: 735 },
			{ items: 5, count: 5, vp: 1365 },
			{ items: 7, count: 5, vp: 2135 },
			{ items: 9, count: 5, vp: 2950 },
			{ items: 12, count: 5, vp: 3945 },
			{ items: 15, vp: 4850 }
		],[
			{ items: 3, count: 3, vp: 735 },
			{ items: 5, count: 5, vp: 1365 },
			{ items: 7, count: 5, vp: 2135 },
			{ items: 9, count: 5, vp: 2950 },
			{ items: 12, count: 5, vp: 3945 },
			{ items: 15, vp: 4850 }
		]
	];

	let rawTurninsToGo = undefined;
	if (vpPerMission) {
		rawTurninsToGo = (vpTopThresh - vpCurr) / vpPerMission;
	}
	let rareVP = undefined;
	if (rareCount <= 0) {
		rareVP = 0;
	}
	else if (rareTurninCount !== undefined && vpPerMission && currEvent.opened_phase !== undefined) {
		const t = vpPerTurninTable[currEvent.opened_phase];
		if (t) {
			rareVP = 0;
			let rareCountLeft = rareCount;
			let rtcIndex = t.findIndex(tt => tt.items === rareTurninCount);
			if (rtcIndex >= 0) {
				// Don't iterate to the last slot of the table
				for (let i=rtcIndex; i < t.length - 1; ++i) {
					if (rareCountLeft <= 0) {
						break;
					}
					const ti = t[i];
					if (ti.count !== undefined) {
						const less = ti.items * ti.count;
						if (less > rareCountLeft) {
							rareVP += (rareCountLeft / ti.items) * ti.vp;
							rareCountLeft = 0;
							break;
						} else {
							rareCountLeft -= less;
							rareVP += ti.count * ti.vp;
						}
					}
				}
			}
			const tf = t[t.length-1];
			rareVP += (rareCountLeft / tf.items) * tf.vp;
		}
	}

	let missionsIncludingRares = 0;
	if (rareVP && vpPerMission) {
		missionsIncludingRares = (vpTopThresh - vpCurr - rareVP) / vpPerMission;
	}

	return (
		<div>
			<h3>Galaxy event: {currEvent.name}</h3>
			<div>
				<EventStat label="Current Rares" value={rareCount ?? 'unknown'} />
				<EventStat label="Est. VP from Rares" value={rareVP ?? 'unknown'} />
				<EventStat label="Est. VP with Rares" value={vpCurr + (rareVP ?? 0)} />
			</div>
			{vpTopThresh > vpCurr && <div>
				<EventStat label="Missions without Rares" value={rawTurninsToGo ?? 'unknown'} />
				<EventStat label="Missions with Rares" value={missionsIncludingRares ?? 'unknown'} />
			</div>}

			<Accordion>
				<Accordion.Title active={activeIndex === 2} index={2} onClick={(e, titleProps) => _handleClick(titleProps)}>
					<Icon name='dropdown' />
					Crew bonuses
				</Accordion.Title>
				<Accordion.Content active={activeIndex === 2}>
					<List horizontal>
						{crew_bonuses.map(cb => (
							<List.Item key={cb.avatar.symbol}>
								<Image avatar src={cb.iconUrl} />
								<List.Content>
									<List.Header>{cb.avatar.name}</List.Header>
									Bonus level {cb.bonus}x
								</List.Content>
							</List.Item>
						))}
					</List>
				</Accordion.Content>
				<Accordion.Title active={activeIndex === 3} index={3} onClick={(e, titleProps) => _handleClick(titleProps)}>
					<Icon name='dropdown' />
					Owned Crew Bonus Table
				</Accordion.Title>
				<Accordion.Content active={activeIndex === 3}>
					<EventCrewBonusTable bonuses={currEvent.content.crew_bonuses!} />
				</Accordion.Content>
				<Accordion.Title active={activeIndex === 1} index={1} onClick={(e, titleProps) => _handleClick(titleProps)}>
					<Icon name='dropdown' />
					Event equipment requirements {eventEquip.length == 0 && '(Pending event start)'}
				</Accordion.Title>
				<Accordion.Content active={activeIndex === 1}>
					<div style={{ display: 'flex', flexDirection: 'column' }}>
					{eventEquip.map(e => {
						const advs = adventures.filter(ad => ad.demands.some(d => d.archetype_id === e.equip.id));
						const adv = advs.length > 0 ? advs[0] : undefined;
						return <div key={e.equip.id} style={{display: 'inline-flex', marginBottom: '15px'}}>
							<h3>
								<ItemDisplay src={STTApi.imgUrl(e.equip.icon, imageCacheUpdated)} style={{ display: 'inline' }}
									size={30} maxRarity={e.equip.rarity} rarity={e.equip.rarity} />
								{e.equip.name}
								{adv && <span style={{fontStyle: 'italic'}}> - {adv.name}</span>}
							</h3>
							<div style={{ display: 'flex', flexDirection: 'column', marginLeft: '10px' }}>{e.itemDemands.map((id, index) => {
								if (!id.archetype) {
									return <span key={index} ><ItemDisplay src={''}
										style={{display: 'inline', fontWeight: 'bold', color: 'red' }}
										size={25} maxRarity={0} rarity={0} />UNKNOWN-NEEDED x{id.rd.count} (have 0)&nbsp;</span>;
								}

								let styleCost = {};
								let styleCount = {};
								let cost = id.cost ?? 0;
								cost = Math.round(cost * 100) / 100;
								let costStr = String(cost);
								if (cost <= 0) {
									costStr = '';
								}
								if (costStr.length > 0 && cost < 0.07) {
									styleCost = {
										fontWeight: cost < 0.07 ? 'bold' : 'normal',
										color: cost < 0.07 ? 'red' : ''
									};
								}
								if (!id.item_quantity || id.item_quantity < 50) {
									styleCount = {
										fontWeight: 'bold',
										color: 'red'
									};
								}

								return <span key={id.item_name}>
									<ItemDisplay src={STTApi.imgUrl(id.archetype.icon, imageCacheUpdated)} style={{ display: 'inline' }}
										size={25} maxRarity={id.archetype.rarity} rarity={id.archetype.rarity} />
									{id.item_name} x{id.rd.count} <span style={styleCount}>(have {id.item_quantity})</span> <span
									style={styleCost}>(cost: {costStr})</span>&nbsp;</span>;
								}
							)}</div>
							<div style={{display: 'flex', flexDirection: 'column', marginLeft: '10px'}}>Best crew: {e.bestCrew.slice(0, 3).map(bc => {
								const isOccupied = bc.crew.frozen > 0 || bc.crew.active_id;
								return <span key={bc.crew.crew_id} style={{ fontStyle: isOccupied ? 'italic' : 'normal' }}>
									<img src={STTApi.imgUrl(bc.crew.portrait, imageCacheUpdated)} width='25' height='25' />&nbsp;
									{bc.crew.name}&nbsp;({bc.chance}%)
									{bc.crew.frozen > 0 && <span> Frozen!</span>}
									{bc.crew.active_id && <span> Active!</span>}
									</span>;
								})}
							</div>
						</div>;
					})}
					</div>
				</Accordion.Content>
				<Accordion.Title active={activeIndex === 0} index={0} onClick={(e, titleProps) => _handleClick(titleProps)}>
					<Icon name='dropdown' />
					Farming list for Galaxy event {farmList.length == 0 && '(Pending event start)'}
				</Accordion.Title>
				<Accordion.Content active={activeIndex === 0}>
					<FarmList farmList={farmList} />
				</Accordion.Content>
			</Accordion>
		</div>
	);
}

const FarmList = (props: {
	farmList: FarmListItem[]
}) => {
	const [sorted, setSorted] = React.useState([{ id: 'quantity', desc: false }] as SortingRule[]);
	const [, imageCacheUpdated] = React.useState<string>('');
	const MAX_PAGE_SIZE = 20;
	let columns = buildColumns();

	return <div className='data-grid' data-is-scrollable='true'>
			<ReactTable
				data={props.farmList}
				columns={columns}
				defaultPageSize={props.farmList.length <= MAX_PAGE_SIZE ? props.farmList.length : MAX_PAGE_SIZE}
				pageSize={props.farmList.length <= MAX_PAGE_SIZE ? props.farmList.length : MAX_PAGE_SIZE}
				sorted={sorted}
				onSortedChange={sorted => setSorted(sorted)}
				showPagination={props.farmList.length > MAX_PAGE_SIZE}
				showPageSizeOptions={false}
				className='-striped -highlight'
				style={props.farmList.length > MAX_PAGE_SIZE ? { height: 'calc(80vh - 88px)' } : {}}
			/>
		</div>;

	function buildColumns() {
		let cols: Column<FarmListItem>[] = [
			{
				id: 'icon',
				Header: '',
				minWidth: 50,
				maxWidth: 50,
				resizable: false,
				sortable: false,
				accessor: (fli) => fli.archetype.name,
				Cell: (cell) => {
					let item : FarmListItem = cell.original;
					return <ItemDisplay src={STTApi.imgUrl(item.archetype.icon, imageCacheUpdated)} size={30} maxRarity={item.archetype.rarity} rarity={item.archetype.rarity}
					// onClick={() => this.setState({ replicatorTarget: found })}
					/>;
				}
			},
			{
				id: 'name',
				Header: 'Name',
				minWidth: 130,
				maxWidth: 180,
				resizable: true,
				accessor: (fli) => fli.archetype.name,
				Cell: (cell) => {
					let item: FarmListItem = cell.original;
					return (
						<a href={getItemDetailsLink(item.archetype)} target='_blank'>
							{item.archetype.name}
						</a>
					);
				}
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				accessor: (fli) => fli.archetype.rarity,
				minWidth: 80,
				maxWidth: 80,
				resizable: false,
				Cell: (cell) => {
					let item: FarmListItem = cell.original;
					return <RarityStars min={1} max={item.archetype.rarity} value={item.archetype.rarity} />;
				}
			},
			{
				id: 'quantity',
				Header: 'Have',
				minWidth: 50,
				maxWidth: 80,
				resizable: true,
				accessor: (fli:FarmListItem) => fli.item ? fli.item.quantity : 0,
			},
			{
				id: 'uses',
				Header: 'Uses',
				minWidth: 50,
				maxWidth: 50,
				resizable: true,
				accessor: 'uses',
			},
			{
				id: 'cost',
				Header: 'Farming Cost',
				minWidth: 50,
				maxWidth: 50,
				resizable: true,
				accessor: (fli) => fli.sources.length == 0 ? 0 : fli.sources.sort((a,b) => b.quotient - a.quotient)[0].quotient,
			},
			{
				id: 'sources',
				Header: 'Sources',
				minWidth: 400,
				maxWidth: 1000,
				resizable: true,
				sortable: false,
				Cell: (cell) => {
					let item: FarmListItem = cell.original;
					if (item.sources.length == 0) return '';
					return item.sources.sort((a,b) => b.quotient - a.quotient)
						.map((src, idx, all) => src.title + (idx === all.length-1 ? '' : ', '));
				}
			}
		];
		return cols;
	}
}
