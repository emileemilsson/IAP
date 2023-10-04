import React from 'react';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { HoverCard } from 'office-ui-fabric-react/lib/HoverCard';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';

import ReactTable, { SortingRule, Column } from 'react-table';
import { isMobile } from 'react-device-detect';

import { ItemDisplay } from '../../utils/ItemDisplay';

import STTApi, { CONFIG, RarityStars, getCrewDetailsLink } from '../../api';
import { CrewData, ItemArchetypeDTO, CrewActionChargePhaseDTO } from '../../api/DTO21';

interface CrewShipListState {
	items: CrewData[];
	sorted: SortingRule[];
}

export const CrewShipList = (props: {
	data: CrewData[];
	sortColumn?: string;
	filterText?: string;
}) => {
	const [sorted, setSorted] = React.useState<SortingRule[]>([{ id: props.sortColumn || 'max_rarity', desc: false }]);
	const [, imageCacheUpdated] = React.useState<string>('');
	// static defaultProps = {
	// 	sortColumn: 'max_rarity',
	// };

	let columns = getColumns();
	let items = props.data;

	if (props.filterText) {
		items = items.filter(i => filterCrew(i, props.filterText!.toLowerCase()))
	}

	return (
		<div className={'data-grid'} data-is-scrollable='true'>
			<ReactTable
				data={items}
				columns={columns}
				defaultPageSize={(items.length <= 50) ? items.length : 50}
				pageSize={(items.length <= 50) ? items.length : 50}
				sorted={sorted}
				onSortedChange={setSorted}
				showPagination={(items.length > 50)}
				showPageSizeOptions={false}
				className="-striped -highlight"
				style={((items.length > 50)) ? { height: 'calc(100vh - 92px)' } : {}}
				getTrProps={(s:any, r:any) => {
					return {
						style: {
							opacity: (r && r.original && r.original.isExternal) ? "0.5" : "inherit"
						}
					};
				}}
				getTdProps={(s: any, r: any) => {
					return { style: { padding: "2px 3px" } };
				}}
			/>
		</div>
	);
	function _onRenderCompactCard(item: CrewData) {
		return <div className="ui items">
			<div className="item">
				<img src={STTApi.imgUrl(item.full_body, imageCacheUpdated)} height={180} />
				<div className="content" style={{ padding: '12px' }}>
					<div className="header">{item.name}</div>
					<div className="meta">{item.flavor}</div>
					<div className="description">Traits: {item.traits.replace(new RegExp(',', 'g'), ', ')}</div>
					<span style={{ fontSize: '0.8rem' }}>id: {item.id}, symbol:{item.symbol}</span>
				</div>
			</div>
		</div>;
	}

	function _onRenderExpandedCard(item: CrewData) {
		let equipment : {e?: ItemArchetypeDTO, have?: boolean }[] = [];
		item.equipment_slots.forEach(es => {
			equipment.push(
				{
					e: STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === es.archetype),
					have: es.have
				}
			);
		});

		let eqTable;
		if (equipment && equipment.length > 0) {
			eqTable = (<div>
				<h4 className="ui header">Equipment</h4>
				<table><tbody>
					<tr>
						{equipment.map((eq, ix) => {
								if (eq.e) {
									return (<td key={eq.e.name + ix}>
										<ItemDisplay src={STTApi.imgUrl(eq.e.icon, imageCacheUpdated)} size={100} maxRarity={eq.e.rarity} rarity={eq.e.rarity} />
										<span style={{ fontSize: '0.8rem', color: eq.have ? "" : "red" }}>{eq.e.name}</span>
									</td>);
								}
								else {
									return <td></td>;
								}
							})
						}
					</tr></tbody>
				</table>
			</div>);
		}

		return (
			<div style={{ padding: '10px' }}>
				{eqTable}
				{ item.action && item.ship_battle && <span>
				<h4 className="ui header">Ship abilitiy '{item.action.name}'</h4>
				<Label>Accuracy +{item.ship_battle.accuracy}  Crit Bonus +{item.ship_battle.crit_bonus}  Crit Rating +{item.ship_battle.crit_chance}  Evasion +{item.ship_battle.evasion}</Label>
				<Label>Increase {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.bonus_type]} by {item.action.bonus_amount}</Label>
				{item.action.penalty && <Label>Decrease {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.penalty.type]} by {item.action.penalty.amount}</Label>}

				{item.action.ability && <Label>Ability: {CONFIG.CREW_SHIP_BATTLE_ABILITY_TYPE[item.action.ability.type].replace('%VAL%', ''+ item.action.ability.amount)} {(item.action.ability.condition > 0) && <span>Trigger: {CONFIG.CREW_SHIP_BATTLE_TRIGGER[item.action.ability.condition]}</span>}</Label>}
				<Label>Duration: {item.action.duration}s  Cooldown: {item.action.cooldown}s  Initial Cooldown: {item.action.initial_cooldown}s  </Label>
				{item.action.limit && <Label>Limit: {item.action.limit} uses per battle</Label>}

				{renderChargePhases(item.action.charge_phases)}
				</span>}
			</div>
		);
	}

	function renderChargePhases(charge_phases: CrewActionChargePhaseDTO[] | undefined) {
		if (!charge_phases) {
			return <span />;
		}

		return <div>
		<h4 className="ui header">Charge phases</h4>
		<div>
			{charge_phases.map((cp, idx) => {
				let phaseDescription = `Charge time: ${cp.charge_time}s`;

				if (cp.ability_amount) {
					phaseDescription += `  Ability amount: ${cp.ability_amount}`;
				}

				if (cp.bonus_amount) {
					phaseDescription += `  Bonus amount: ${cp.bonus_amount}`;
				}

				if (cp.duration) {
					phaseDescription += `  Duration: ${cp.duration}s`;
				}

				if (cp.cooldown) {
					phaseDescription += `  Cooldown: ${cp.cooldown}s`;
				}

				return <Label key={idx}>{phaseDescription}</Label>;
			})}
			</div>
		</div>;
	}

	function getColumns() {
		let _columns : Column<CrewData>[] = [];

		_columns.push({
			id: 'icon',
			Header: '',
			minWidth: 28,
			maxWidth: 28,
			resizable: false,
			accessor: 'name',
			Cell: (cell) => {
				if (cell && cell.original) {
					return <Image src={STTApi.imgUrl((cell.original as CrewData).portrait, imageCacheUpdated)} width={22} height={22} imageFit={ImageFit.contain} shouldStartVisible={true} />;
				} else {
					return <span />;
				}
			},
			Aggregated: (row) => <span />
		});

		if (!isMobile) {
			_columns.push({
				id: 'short_name',
				Header: 'Name',
				minWidth: 90,
				maxWidth: 110,
				resizable: true,
				accessor: 'short_name',
				Cell: (cell) => {
					if (cell && cell.original) {
						return <a href={getCrewDetailsLink(cell.original)} target='_blank'>{cell.original.short_name}</a>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			});
		}

		_columns.push({
				id: 'name',
				Header: 'Full name',
				minWidth: 110,
				maxWidth: 190,
				resizable: true,
				accessor: 'name',
			Cell: (cell) => {
					if (cell && cell.original) {
						return <HoverCard id="nameHoverCard"
							expandingCardProps={{
								compactCardHeight: 180,
								expandedCardHeight: 420,
								renderData: cell.original,
								onRenderExpandedCard: _onRenderExpandedCard,
								onRenderCompactCard: _onRenderCompactCard,
								styles: { root: { width: '520px' } }
							}}
							instantOpenOnClick={true}>
							<span>{cell.original.name}</span>
						</HoverCard>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			},
			{
				id: 'level',
				Header: 'Level',
				minWidth: 40,
				maxWidth: 45,
				resizable: false,
				accessor: 'level',
				aggregate: (vals) => vals.reduce((a:any, b:any) => a + b, 0) / vals.length,
				Aggregated: (row) => <span>{Math.floor(row.value)}</span>
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				// Sort all by max fusion level, then fractional part by current fusion level
				accessor: (obj) => obj.max_rarity + (obj.rarity / obj.max_rarity),
				minWidth: 75,
				maxWidth: 85,
				resizable: false,
				Cell: (cell) => {
					if (cell && cell.original) {
						return <RarityStars min={1} max={cell.original.max_rarity} value={cell.original.rarity ? cell.original.rarity : null} />;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			});

		if (!isMobile) {
			_columns.push({
				id: 'favorite',
				Header: () => <Icon iconName='FavoriteStar' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'favorite',
				Cell: (cell) => {
					if (cell && cell.original && cell.value) {
						return <TooltipHost content={`You marked ${cell.original.short_name} as favorite in the game`} calloutProps={{ gapSpace: 0 }}>
							<Icon iconName='FavoriteStar' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			},
			{
				id: 'frozen',
				Header: () => <Icon iconName='Snowflake' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'frozen',
				Cell: (cell) => {
					if (cell && cell.value && cell.original) {
						return <TooltipHost content={`You have ${(cell.value === 1) ? 'one copy' : `${cell.value} copies`} of ${cell.original.short_name} frozen (cryo-d)`} calloutProps={{ gapSpace: 0 }}>
							{cell.value > 1 ? cell.value : ''}<Icon iconName='Snowflake' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				aggregate: (vals) => vals.map((v:any) => v ? 1 : 0).reduce((a:any, b:any) => a + b, 0),
				Aggregated: (row) => <span>{Math.floor(row.value)}</span>
			});
		}

		_columns.push({
				id: 'abilitytype',
				Header: 'Type',
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: (cd) => CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[cd.action!.bonus_type],
			}, {
				id: 'abilityamt',
				Header: 'Amt',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.action!.bonus_amount || 0,
			}, {
				id: 'abilityact',
				Header: 'Act',
				minWidth: 50,
				maxWidth: 100,
				resizable: true,
				accessor: (cd) => cd.action!.ability ? CONFIG.CREW_SHIP_BATTLE_ABILITY_TYPE_SHORT[cd.action!.ability!.type] : '',
			}, {
				id: 'abilityactamt',
				Header: 'ActAmt',
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: (cd) => cd.action!.ability ? cd.action!.ability!.amount : '',
			}, {
				id: 'abilityinit',
				Header: 'Init',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.action!.initial_cooldown || 0,
			}, {
				id: 'abilitydur',
				Header: 'Dur',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.action!.duration || 0,
			}, {
				id: 'abilitycd',
				Header: 'Cooldown',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.action!.cooldown || 0,
			}, {
				id: 'abilitylim',
				Header: 'Uses',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.action!.limit,
//TODO: trigger and penalty
			}, {
				id: 'charget',
				Header: 'ChTime',
				minWidth: 40,
				maxWidth: 50,
				resizable: true,
				accessor: (cd) => cd.action!.charge_phases ? cd.action!.charge_phases.map(cp => cp.charge_time).join() : '',
			}, {
				id: 'chargeaa',
				Header: 'ChAmt',
				minWidth: 40,
				maxWidth: 100,
				resizable: true,
				accessor: (cd) => cd.action!.charge_phases && cd.action!.charge_phases[0].ability_amount ? cd.action!.charge_phases.map(cp => cp.ability_amount).join() : '',
			}, {
				id: 'chargeba',
				Header: 'ChBonus',
				minWidth: 40,
				maxWidth: 50,
				resizable: true,
				accessor: (cd) => cd.action!.charge_phases && cd.action!.charge_phases[0].bonus_amount ? cd.action!.charge_phases.map(cp => cp.bonus_amount).join() : '',
			}, {
				id: 'chargedur',
				Header: 'ChDur',
				minWidth: 40,
				maxWidth: 50,
				resizable: true,
				accessor: (cd) => cd.action!.charge_phases && cd.action!.charge_phases[0].duration ? cd.action!.charge_phases.map(cp => cp.duration).join() : '',
			}, {
				id: 'chargecd',
				Header: 'ChCd',
				minWidth: 40,
				maxWidth: 50,
				resizable: true,
				accessor: (cd) => cd.action!.charge_phases && cd.action!.charge_phases[0].cooldown ? cd.action!.charge_phases.map(cp => cp.cooldown).join() : '',
			}, {
				id: 'passiveacc',
				Header: 'ACC',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.ship_battle!.accuracy || 0,
			}, {
				id: 'passiveev',
				Header: 'EV',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.ship_battle!.evasion || 0,
			}, {
				id: 'passivecb',
				Header: 'Crit',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.ship_battle!.crit_bonus || 0,
			}, {
				id: 'passivecc',
				Header: 'CR',
				minWidth: 30,
				maxWidth: 40,
				resizable: true,
				accessor: (cd) => cd.ship_battle!.crit_chance || 0,
			},{
				id: 'traits',
				Header: 'Traits',
				minWidth: 140,
				resizable: true,
				accessor: 'traits',
				Cell: (cell) => <div style={ { overflow: 'hidden', textOverflow: 'ellipsis', height: '22px' } }>{cell.original.traits.replace(/,/g, ', ')}</div>,
			});

		return _columns;
	}

	function filterCrew(crew: CrewData, searchString: string) {
		return searchString.split(';').some(segment => {
			if (segment.trim().length == 0) return false;
			return segment.split(' ').every(text => {
				if (text.trim().length == 0) return false;
				// search the name first
				if (crew.name.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the traits
				if (crew.traits.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the raw traits
				if (crew.rawTraits.find(trait => trait.toLowerCase().indexOf(text) > -1)) {
					return true;
				}

				if (crew.action) {
					// Check for bonus type name
					if ((CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[crew.action.bonus_type] || '').toLowerCase().indexOf(text) > -1) {
						return true;
					}

					if (crew.action.ability && (CONFIG.CREW_SHIP_BATTLE_ABILITY_TYPE_SHORT[crew.action.ability.type] || '').toLowerCase().indexOf(text) > -1) {
						return true;
					}
				}

				return false;
			});
		});
	}
}
