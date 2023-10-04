import React from 'react';

import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import ReactTable, { Column, SortingRule } from 'react-table';
import STTApi, { formatTimeSeconds, CONFIG, RarityStars, getCrewDetailsLink } from '../../api';
import { EventDTO, CrewData, EventLeaderboardEntryDTO } from "../../api/DTO21";
import { GalaxyEvent } from './EventHelperGalaxy';
import { ShuttleEvent } from './EventHelperShuttle';
import { SkirmishEvent } from './EventHelperSkirmish';
import { ExpeditionEvent } from './EventHelperExpedition';
import { isMobile } from 'react-device-detect';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { SkillCell } from '../crew/SkillCell';

export const EventHelperPage = (props: {
	onTabSwitch?: (newTab: string) => void;
}) => {
	const [eventImageUrl, setEventImageUrl] = React.useState<string | undefined>();

	let currEvent : EventDTO | undefined = undefined;
	if (
		STTApi.playerData.character.events &&
		STTApi.playerData.character.events.length > 0 &&
		STTApi.playerData.character.events[0].content
	) {
		currEvent = STTApi.playerData.character.events[0];
		let url : string | undefined = undefined;

		if (currEvent.opened && currEvent.opened_phase !== undefined) {
			url = currEvent.phases[currEvent.opened_phase].splash_image.file;
		}
		else if (currEvent.phases && currEvent.phases.length > 0) {
			url = currEvent.phases[0].splash_image.file;
		}
		if (url) {
			STTApi.imageProvider.getImageUrl(url, currEvent.id)
				.then(found => setEventImageUrl(found.url))
				.catch(error => {
					console.warn(error);
				});
		}
	}

	if (!currEvent) {
		return <div className='tab-panel' data-is-scrollable='true'>
			<h2>There is no current event in progress or waiting to begin.</h2>
		</div>
	}

	let hasStarted = currEvent.seconds_to_start <= 0;
	let hasEnded = currEvent.seconds_to_end <= 0;
	let msg = '';
	if (hasEnded) {
		msg = ' has ended and has rewards to collect in-game';
	} else if (hasStarted) {
		msg = ' has started and ends in ' + formatTimeSeconds(currEvent.seconds_to_end);
	} else {
		msg = ' starts in ' + formatTimeSeconds(currEvent.seconds_to_start);
	}

	const vpCurr = currEvent.victory_points ?? 0;
	const vpTopThresh = currEvent.threshold_rewards[currEvent.threshold_rewards.length - 1].points;

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<h2>Event {msg}</h2>
			<h2>{currEvent.name}</h2>
			{ eventImageUrl &&
				<Image height='200px' src={eventImageUrl} />
			}
			<p>{currEvent.description}</p>

			<div>
				<EventStat label="Current VP" value={vpCurr} />
				{vpTopThresh > vpCurr &&
					<EventStat label="Top Threshold VP" value={vpTopThresh} />
				}
			</div>

			<EventLeaderboard event={currEvent} />
			<div><h4>{currEvent.bonus_text}</h4></div>

			<GalaxyEvent event={currEvent} />
			<ShuttleEvent event={currEvent} onTabSwitch={props.onTabSwitch} />
			<SkirmishEvent event={currEvent} onTabSwitch={props.onTabSwitch} />
			<ExpeditionEvent event={currEvent} onTabSwitch={props.onTabSwitch} />
		</div>
	);
}

export const EventStat = (props: {
	value: number | string,
	label: string,
	classAdd?: string
}) => {
	let value = props.value;
	if (typeof value === 'number') {
		value = Math.trunc(value * 100) / 100;
	}
	return <div className={`${props.classAdd ? props.classAdd : ''} ui tiny statistic`}>
		<div className="label" style={{ color: 'unset' }}>{props.label}</div>
		<div className="value" style={{ color: props.classAdd || 'unset' }}>{value}</div>
	</div>;
}

interface RewardBracket {
	hi: number;
	lo: number;
	vpHi: number;
	vpLo?: number;
}

const EventLeaderboard = (props:{
	event: EventDTO
}) => {
	if (props.event.seconds_to_start > 0) {
		return <span/>;
	}
	const [brackets, setBrackets] = React.useState<RewardBracket[]>([])
	const [playerRank, setPlayerRank] = React.useState<number | undefined>()
	const [updn, setUpDn] = React.useState<(EventLeaderboardEntryDTO | undefined)[]>([]);

	//HACK: this can only get 100 "top" or 100 "centered" event participants; no known way
	//      to request a particular window of ranks
	const count = 100
	React.useEffect(() => {
		STTApi.loadEventLeaderboard(props.event.instance_id, count).then(lb => {
			let newBrackets : RewardBracket[] = [];
			props.event.ranked_brackets.filter(rb => rb.first <= count).forEach(rb => {
				const hi = lb.leaderboard[rb.first-1]
				const me = lb.leaderboard.find(lbe => lbe.pid === STTApi.playerData.id);
				const lo = rb.last-1 < lb.leaderboard.length ? lb.leaderboard[rb.last-1] : undefined
				let rew : RewardBracket = {
					hi: rb.first,
					lo: rb.last,
					vpHi: hi.score,
					vpLo: lo?.score
				};
				newBrackets.push(rew);
			});
			setBrackets(newBrackets);
			setPlayerRank(lb.player_rank);
		});
		STTApi.loadEventLeaderboard(props.event.instance_id, count, false).then(lb => {
			const p = lb.leaderboard.length / 2;
			let updnNew: (EventLeaderboardEntryDTO | undefined)[] = [];
			updnNew.push(lb.leaderboard[0]);
			updnNew.push(lb.leaderboard[lb.leaderboard.length/4]);
			updnNew.push(lb.leaderboard[p - 10]);
			updnNew.push(lb.leaderboard.find(lbe => lbe.pid === STTApi.playerData.id));
			updnNew.push(lb.leaderboard[p + 10]);
			updnNew.push(lb.leaderboard[lb.leaderboard.length / 4 * 3]);
			updnNew.push(lb.leaderboard[lb.leaderboard.length-1]);
			setUpDn(updnNew);
			//TODO: if we are close enough to a bracket edge to see it, then show that
			//let newBrackets: RewardBracket[] = [];
			// props.event.ranked_brackets.forEach(rb => {
			//    const hi = lb.leaderboard[rb.first - 1]
			//    const lo = rb.last - 1 < lb.leaderboard.length ? lb.leaderboard[rb.last - 1] : undefined
			//    let rew: RewardBracket = {
			//       hi: rb.first,
			//       lo: rb.last,
			//       vpHi: hi.score,
			//       vpLo: lo?.score
			//    };
			//    newBrackets.push(rew);
			// });
			//setBrackets(newBrackets)
		});
	}, []);

	return <div>
		Ranked reward threshhold current VP:
		<ul><li>Rank: VP For Rank</li>
			{brackets.map(br => <li key={br.hi}>{br.hi}: {br.vpHi}{inBracket(br) && <span>Current VP: {props.event.victory_points}</span> }</li>)}
		</ul>
		<ul><li>Rank: VP For Rank</li>
			<li>Up 50 - {updn[0] ? (updn[0].rank + ': ' + updn[0].score + ' (+' + (updn[0].score - (updn[3]?.score ?? 0)) + ')') : 'unknown'}</li>
			<li>Up 25 - {updn[1] ? (updn[1].rank + ': ' + updn[1].score + ' (+' + (updn[1].score - (updn[3]?.score ?? 0)) + ')') : 'unknown'}</li>
			<li>Up 10 - {updn[2] ? (updn[2].rank + ': ' + updn[2].score + ' (+' + (updn[2].score - (updn[3]?.score ?? 0)) + ')') : 'unknown'}</li>
			<li>Current Rank - { updn[3] ? (updn[3].rank + ': ' + updn[3].score) : 'unknown'}</li>
			<li>Down 10 - {updn[4] ? (updn[4].rank + ': ' + updn[4].score + ' (-' + ((updn[3]?.score ?? 0) - updn[4].score) + ')') : 'unknown'}</li>
			<li>Down 25 - {updn[5] ? (updn[5].rank + ': ' + updn[5].score + ' (-' + ((updn[3]?.score ?? 0) - updn[5].score) + ')') : 'unknown'}</li>
			<li>Down 50 - {updn[6] ? (updn[6].rank + ': ' + updn[6].score + ' (-' + ((updn[3]?.score ?? 0) - updn[6].score) + ')') : 'unknown'}</li>
		</ul>
	</div>;

	function inBracket(br: RewardBracket) {
		if (props.event.victory_points === undefined || props.event.victory_points <= 0) {
			return false;
		}
		if (props.event.victory_points < br.vpHi) {
			return false;
		}
		if (br.vpLo === undefined) {
			return true;
		}
		return props.event.victory_points >= br.vpLo;
	}
}

export const EventCrewBonusTable = (props: {
	bonuses: { [crew_symbol: string]: number; };
	onlyBonusCrew?: boolean;
	hideBonus?: boolean;
}) => {
	const [sorted, setSorted] = React.useState([{ id: 'bonus', desc: true }] as SortingRule[]);
	const [filterText, setFilterText] = React.useState('');
	const [, imageCacheUpdated] = React.useState<string>('');

	let columns = getColumns();

	let items: CrewData[] = []; // array of CrewData with additional 'bonus' field
	for (let cb in props.bonuses) {
		let avatar = STTApi.getCrewAvatarBySymbol(cb);
		if (!avatar) {
			continue;
		}

		let crews = STTApi.roster.filter(c => c.symbol === avatar!.symbol);
		if (!crews.length) {
			continue;
		}

		let bonusValue = props.bonuses[cb];

		crews.forEach(crew => {
			// override skills and skill data shallow copies and incorporate bonuses directly
			let skills = { ...crew.skills };
			for (let sk in CONFIG.SKILLS) {
				skills[sk] = {
					core: skills[sk].core * bonusValue,
					min: 0,
					max: 0,
					voy: 0
				};
			}
			let bonusCrew = {
				...crew,
				// additional properties not in CrewData
				bonus: bonusValue,
				skills
			};

			items.push(bonusCrew);
		});
	}

	let bonusCrewCount = items.length;

	if (!props.onlyBonusCrew) {
		let allCrew = STTApi.roster.filter(c => !c.buyback);
		allCrew.forEach(owned => {
			let found = items.find(c => c.id === owned.id);
			if (!found) {
				items.push(owned);
			}
		});
	}

	if (filterText) {
		items = items.filter(i => filterCrew(i, filterText!.toLowerCase()))
	}

	function getColumns(showBuyBack?: boolean) {
		let _columns: Column<CrewData>[] = [];
		let compactMode = true;

		_columns.push({
			id: 'icon',
			Header: '',
			minWidth: compactMode ? 28 : 60,
			maxWidth: compactMode ? 28 : 60,
			resizable: false,
			accessor: 'name',
			Cell: (cell) => {
				if (cell && cell.original) {
					return <Image src={STTApi.imgUrl((cell.original as CrewData).portrait, imageCacheUpdated)} width={compactMode ? 22 : 50} height={compactMode ? 22 : 50} imageFit={ImageFit.contain} shouldStartVisible={true} />;
				} else {
					return <span />;
				}
			},
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
			});
		}

		_columns.push({
				id: 'name',
				Header: 'Full name',
				minWidth: 110,
				maxWidth: 190,
				resizable: true,
				accessor: 'name',
			},
			{
				id: 'level',
				Header: 'Level',
				minWidth: 40,
				maxWidth: 45,
				resizable: false,
				accessor: 'level',
				style: { 'textAlign': 'center' }
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
						return <Icon iconName='FavoriteStar' />;
					} else {
						return <span />;
					}
				},
			});
		}

		let colsCore: Column<CrewData>[] = [];
		for (let sk in CONFIG.SKILLS_SHORT) {
			let head = CONFIG.SKILLS_SHORT[sk];
			colsCore.push({
				id: sk,
				Header: head,
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: (crew) => crew.skills[sk].core,
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.skills[sk]} compactMode={compactMode} /> : <span />,
			});
		}
		colsCore.sort((a, b) => (a.Header as string).localeCompare(b.Header as string));

		_columns.push(
			{
				id: 'frozen',
				Header: () => <Icon iconName='Snowflake' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'frozen',
				Cell: (cell: any) => {
					if (cell && cell.value && cell.original) {
						return <TooltipHost content={`You have ${(cell.value === 1) ? 'one copy' : `${cell.value} copies`} of ${cell.original.short_name} frozen (cryo-d)`} calloutProps={{ gapSpace: 0 }}>
							{cell.value > 1 ? cell.value : ''}<Icon iconName='Snowflake' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
			});
		if (!props.hideBonus) {
			_columns.push({
				id: 'bonus',
				Header: 'Bonus',
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: 'bonus',
				style: { 'textAlign': 'center' },
				Cell: cell => <span>{cell.value ? cell.value + 'x' : ''}</span>
			});
		}
		_columns.push(
			{
				id: 'active_id',
				Header: () => <Icon iconName='Balloons' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'active_id',
				Cell: (cell) => {
					if (cell && cell.original && cell.original.active_id) {
						let isShuttle = false;
						STTApi.playerData.character.shuttle_adventures.forEach((shuttle) => {
							if (shuttle.shuttles[0].id === cell.original.active_id) {
								isShuttle = true;
							}
						});
						return isShuttle ? 'S' : 'V';
					} else {
						return <span />;
					}
				},
			},
			...colsCore,
			{
				id: 'traits',
				Header: 'Traits',
				minWidth: 140,
				resizable: true,
				accessor: 'traits',
				Cell: (cell) => cell.original ? <div style={compactMode ? { overflow: 'hidden', textOverflow: 'ellipsis', height: '22px' } : { whiteSpace: 'normal', height: '50px' }}>{cell.original.traits.replace(/,/g, ', ')}</div> : <span />,
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

				if ((crew as any).bonus) {
					return ((crew as any).bonus == text);
				}

				return false;
			});
		});
	}

	return (<span>
		Owned Event Bonus Crew: {bonusCrewCount}
		<SearchBox placeholder='Search by name or trait...'
			onChange={(ev, newValue) => setFilterText(newValue ?? '')}
			onSearch={(newValue) => setFilterText(newValue)}
		/>
		<div className='data-grid' data-is-scrollable='true'>
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
				style={(items.length > 50) ? { height: 'calc(100vh - 200px)' } : {}}
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
	</span>
	);
};
