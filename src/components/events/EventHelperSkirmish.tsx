import React from 'react';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { Label, Popup, List } from 'semantic-ui-react';
import ReactTable, { Column } from 'react-table';
import { EventDTO, EVENT_TYPES, CrewData } from "../../api/DTO21";
import STTApi, { RarityStars, CONFIG, getCrewDetailsLink } from '../../api';
import { EventStat } from './EventHelperPage';

type CrewBonus = {
	iconUrl: string,
	crew: CrewData
};

export const SkirmishEvent = (props: {
	event: EventDTO;
	onTabSwitch?: (newTab: string) => void;
}) => {
	const [sorted, setSorted] = React.useState([{ id: 'max_rarity', desc: false }]);
	const [, imageCacheUpdated] = React.useState<string>('');

	if (!props.event ||
		!props.event.content ||
		props.event.content.content_type !== EVENT_TYPES.SKIRMISH
	) {
		return <span />;
	}

	if (!props.event.content.bonus_crew) {
		let ref = <span>Crew Ship Details</span>;
		if (props.onTabSwitch) {
			ref = <Label as='a' onClick={() => props.onTabSwitch!('CrewShip')}>Crew Ship Details</Label>;
		}

		return <div><h2>Skirmish Event Details</h2>
			Event bonus crew data not yet available, but you can check the {ref} page to start planning.
		</div>;
	}

	if (props.event.content.bonus_crew.length === 0) {
		let ref = <span>Crew Ship Details</span>;
		if (props.onTabSwitch) {
			ref = <Label as='a' onClick={() => props.onTabSwitch!('CrewShip')}>Crew Ship Details</Label>;
		}

		return <div><h2>Mini (Skirmish) Event Details</h2>
		</div>;
	}

	let crew_bonuses: CrewBonus[] = [];
	props.event.content.bonus_crew.forEach(bcSymbol => {
		let avatar = STTApi.getCrewAvatarBySymbol(bcSymbol);
		if (!avatar) {
			return;
		}

		let crew = STTApi.roster.find(c => c.symbol === avatar!.symbol);
		if (!crew) {
			return;
		}

		let iconUrl = STTApi.imgUrl(crew.portrait, imageCacheUpdated);

		crew_bonuses.push({
			crew,
			iconUrl
		});
	});

	let crew_bonuses_minor: CrewBonus[] = [];
	let items : CrewData[] = [];
	STTApi.roster.forEach(crew => {
		if (props.event.content.bonus_traits.length > 0) {
			if (!crew.rawTraits.some(tr => props.event.content.bonus_traits.includes(tr))) {
				if (!props.event.content.bonus_crew.includes(crew.symbol)) {
					return;
				}
			}
		}

		let iconUrl = STTApi.imgUrl(crew.portrait, imageCacheUpdated);

		crew_bonuses_minor.push({
			crew,
			iconUrl
		});
		items.push(crew);
	});

	const columns = getColumns();

	const vpCurr = props.event.victory_points ?? 0;
	const vpTopThresh = props.event.threshold_rewards[props.event.threshold_rewards.length - 1].points;

	const vpPerRun = 6000; // 6000 = fully bonused run
	const intelPerChronSpent = 10;
	const kitDiscount = 0.75;
	let vpToGo = vpTopThresh - vpCurr;
	let intelCount = Math.floor((props.event.content.currency.seconds_from_basis / props.event.content.currency.rate) ?? 0);
	let runsAfforded = intelCount / props.event.content.start_cost;
	let vpAfforded = runsAfforded * vpPerRun;
	let intelToSpend = vpToGo * (props.event.content.start_cost / vpPerRun);
	let intelToGain = intelToSpend - intelCount;
	let runsToGo = intelToSpend / props.event.content.start_cost;
	let chronsToSpend = intelToGain / intelPerChronSpent;
	let chronsToSpendWithKit = chronsToSpend * kitDiscount;
	let intelAccrued = undefined;
	if (props.event.opened_phase !== undefined) {
		let secondsToEnd = props.event.phases[props.event.opened_phase].seconds_to_end;
		intelAccrued = secondsToEnd / props.event.content.currency.rate;
	}

	return <div><h3>Skirmish Event Details</h3>
		<div>
			<EventStat label="Intel" value={intelCount ?? 'unknown'} />
			<EventStat label="Skirmishes Afforded" value={runsAfforded ?? 'unknown'} />
			<EventStat label="VP Afforded" value={vpAfforded ?? 0} />
			<EventStat label="Intel gained to phase end" value={intelAccrued ?? 'unknown'} />
		</div>
		{vpToGo > 0 && <div>
			<EventStat label="Skirmishes to go" value={runsToGo ?? 'unknown'} />
			<EventStat label="VP to go" value={vpToGo ?? 'unknown'} />
			<EventStat label="Intel to top threshold" value={intelToSpend ?? 'unknown'} />
			<EventStat label="Intel needed" value={intelToGain ?? 'unknown'} />
			<EventStat label="Chrons to top threshold" value={chronsToSpend ?? 'unknown'} />
			<EventStat label="Chrons with kit" value={chronsToSpendWithKit ?? 'unknown'} />
		</div>}
		<div style={{ margin: '0' }}>
			<span>
				<div>Bonus Event Crew (Major Bonus): {props.event.content.bonus_crew.join(', ')}</div>
				Owned bonus crew: <List horizontal>{crew_bonuses.map(cb => <CrewBonusEntry key={cb.crew.id} cb={cb} />)}</List>
				{/* TODO: use event helper page renderCrewBonus and remove from HomePage */}
				<div>Bonus Crew (Minor Bonus) traits: {props.event.content.bonus_traits.join(', ')}</div>
			</span>
			<div className={'data-grid'} data-is-scrollable='true'>
				<ReactTable
					data={items}
					columns={columns}
					defaultPageSize={(items.length <= 50) ? items.length : 50}
					pageSize={(items.length <= 50) ? items.length : 50}
					sorted={sorted}
					onSortedChange={sorted => setSorted(sorted)}
					showPagination={(items.length > 50)}
					showPageSizeOptions={false}
					className="-striped -highlight"
					style={((items.length > 50)) ? { height: 'calc(100vh - 88px)' } : {}}
					getTrProps={(s: any, r: any) => {
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

		</div>
	</div>;

	function CrewBonusEntry(props: { cb: CrewBonus }) {
		let cb = props.cb;
		return <Popup flowing key={cb.crew.symbol}
			trigger={
				<List.Item >
					<img src={cb.iconUrl} width="25" height="25" />
					<List.Content>
						<List.Header>{cb.crew.name}</List.Header>
						<RarityStars min={1} max={cb.crew.max_rarity} value={cb.crew.rarity} />
						{cb.crew.level < 100 && <div>Level {cb.crew.level}</div>}
						{cb.crew.frozen > 0 && <div>Frozen</div>}
					</List.Content>
				</List.Item>
			}
			content={<span key={cb.crew.id}>
				Base: {Object.keys(cb.crew.skills).map(s => {
					return (<span key={s}><img src={CONFIG.SPRITES['icon_' + s].url} height={18} />
						{cb.crew.skills[s].core} ({cb.crew.skills[s].min}-{cb.crew.skills[s].max})
						</span>);
				})}
			</span>}
		/>
	}

	// Copies CrewShipList details with some small changes for skirmish crew bonus info
	function getColumns() {
		let _columns: Column<CrewData>[] = [];

		_columns.push({
				id: 'icon',
				Header: '',
				minWidth: 28,
				maxWidth: 28,
				resizable: false,
				accessor: 'name',
				Cell: (cell) => {
					return <Image src={STTApi.imgUrl((cell.original as CrewData).portrait, imageCacheUpdated)} width={22} height={22} imageFit={ImageFit.contain} shouldStartVisible={true} />;
				},
			},{
				id: 'short_name',
				Header: 'Name',
				minWidth: 90,
				maxWidth: 110,
				resizable: true,
				accessor: 'short_name',
				Cell: (cell) => {
					return <a href={getCrewDetailsLink(cell.original)} target='_blank'>{cell.original.short_name}</a>;
				},
			},{
				id: 'name',
				Header: 'Full name',
				minWidth: 110,
				maxWidth: 190,
				resizable: true,
				accessor: 'name',
				Cell: (cell) => {
					return <span>{cell.original.name}</span>;
				},
			},
			{
				id: 'level',
				Header: 'Level',
				minWidth: 40,
				maxWidth: 45,
				resizable: false,
				accessor: 'level',
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
					return <RarityStars min={1} max={cell.original.max_rarity} value={cell.original.rarity ? cell.original.rarity : null} />;
				},
			// },{
			//    id: 'favorite',
			//    Header: () => <Icon iconName='FavoriteStar' />,
			//    minWidth: 30,
			//    maxWidth: 30,
			//    style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
			//    resizable: false,
			//    accessor: 'favorite',
			//    Cell: (cell) => {
			//       if (cell.value) {
			//          <Icon iconName='FavoriteStar' />
			//       } else {
			//          return <span></span>;
			//       }
			//    },
			},
				{
					id: 'frozen',
					Header: () => <Icon iconName='Snowflake' />,
					minWidth: 30,
					maxWidth: 30,
					style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
					resizable: false,
					accessor: 'frozen',
					Cell: (cell: any) => {
						if (cell.value > 0) {
							return <span>{cell.value > 1 ? cell.value : ''}<Icon iconName='Snowflake' /></span>;
						}
						return <span></span>;
					},
				},{
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
		}, {
			id: 'traits',
			Header: 'Traits',
			minWidth: 140,
			resizable: true,
			accessor: 'traits',
			Cell: (cell) => <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', height: '22px' }}>{cell.original.traits.replace(/,/g, ', ')}</div>,
		});

		return _columns;
	}
}
