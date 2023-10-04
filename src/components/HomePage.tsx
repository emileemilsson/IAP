import React from 'react';
import { Label } from 'semantic-ui-react';

import { ItemDisplay } from '../utils/ItemDisplay';
import Moment from 'moment';

import STTApi from '../api';
import { CONFIG, getChronitonCount, formatTimeSeconds, loadVoyage } from '../api';
import { loadGauntlet } from './gauntlet/GauntletTools';

import { openDevTools } from '../utils/pal';
import { EVENT_TYPES, SHUTTLE_STATE_NAMES,
	PlayerShuttleDTO,
	SHUTTLE_STATE_NAME_UNKNOWN, SHUTTLE_STATE_COMPLETE,
	SHUTTLE_STATE_INPROGRESS, SHUTTLE_STATE_OPENED } from '../api/DTO';
import { VOYAGE_AM_DECAY_PER_MINUTE, voyDuration } from './voyage/VoyageTools';

const Priority = {
	INFO: 'info circle green',
	CHECK: 'check circle green',
	QUESTION: 'question circle yellow',
	HOURGLASS: 'hourglass half yellow',
	EXCLAMATION: 'exclamation circle yellow',
	EXCLAMATIONRED: 'exclamation circle red'
};

const Recommendation = (props: {
	icon: string;
	title: string;
	children?: any;
}) => {
	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'minmax(min-content,50px) auto',
				gridTemplateAreas: `'icon description'`,
				marginBottom: '10px'
			}}>
			<div style={{ gridArea: 'icon' }}>
				<i className={'huge icon ' + props.icon || Priority.CHECK} />
			</div>
			<div style={{ gridArea: 'description' }}>
				<h5 style={{ margin: '0' }}>{props.title}</h5>
				<div>{props.children}</div>
			</div>
		</div>
	);
}

export const HomePage = (props: {
	onLogout: () => void;
	onRefresh: () => void;
	onTabSwitch?: (newTab: string) => void;
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');
	//TODO: seconds_from_last_boost_claim - for ad warping?

	if (STTApi.playerData.character.open_packs && STTApi.playerData.character.open_packs.length > 0) {
		// Active behold
		// TODO: help with making choice
	}

	// const neededEquipment = STTApi.getNeededEquipment(
	// 	{ onlyNeeded: true, onlyFaction: false, cadetable: false, allLevels: false, userText: undefined },
	// 	[]
	// );
	// let factionBuyable = [];
	// for (let equipment of neededEquipment) {
	// 	factionBuyable = factionBuyable.concat(
	// 		equipment.factionSources.map(
	// 			entry =>
	// 				`${equipment.equipment.name} for ${entry.cost_amount} ${CONFIG.CURRENCIES[entry.cost_currency].name} in the ${
	// 					entry.faction.name
	// 				} shop`
	// 		)
	// 	);
	// }
	// if (factionBuyable.length > 0) {
	// 	recommendations.push({
	// 		title: 'Needed equipment in the faction shops',
	// 		icon: Priority.INFO,
	// 		content: (
	// 			<p style={{ margin: '0' }}>
	// 				You can find some needed equipment in the faction shops: <b>{factionBuyable.join(', ')}</b>. Check them out in the 'Factions'
	// 				tab.
	// 			</p>
	// 		)
	// 	});
	// }

	if (!STTApi.loggedIn) {
		return <span />;
	}

	return (
		<div>
			<div className='ui right aligned inverted segment'>
				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['energy_icon'].url} className='ui' />
					{getChronitonCount()?.toLocaleString()}
				</div>

				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['images_currency_pp_currency_0'].url} className='ui' />
					{STTApi.playerData.premium_purchasable?.toLocaleString()}
				</div>

				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['images_currency_pe_currency_0'].url} className='ui' />
					{STTApi.playerData.premium_earnable?.toLocaleString()}
				</div>

				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['images_currency_honor_currency_0'].url} className='ui' />
					{STTApi.playerData.honor?.toLocaleString()}
				</div>

				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['images_currency_sc_currency_0'].url} className='ui' />
					{STTApi.playerData.money?.toLocaleString()}
				</div>

				{ STTApi.playerData.character.stimpack &&
					<div className='ui black large image label'>
						Supply Kit Active (expires in {formatTimeSeconds(STTApi.playerData.character.stimpack.ends_in)})
					</div>
				}

				<button className='ui button' onClick={() => props.onLogout()}>
					<i className='icon sign out' />
					Logout
				</button>
				<button className='ui primary button' onClick={() => props.onRefresh()}>
					<i className='icon refresh' />
					Refresh
				</button>
				<button className='ui icon button' onClick={() => openDevTools()}>
					<i className='icon bug' />
				</button>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gridTemplateAreas: `'image description'` }}>
				<div style={{ gridArea: 'image' }}>
					<img src={STTApi.imgUrl(STTApi.playerData.character.crew_avatar?.full_body, imageCacheUpdated)} height='320px' />
				</div>
				<div style={{ gridArea: 'description' }}>
					<h3>Welcome, {STTApi.playerData.character.display_name}!</h3>
					<p>DBID {STTApi.playerData.dbid}</p>
					<p>
						Location{' '}
						{
							STTApi.playerData.character.navmap.places.find(place => place.symbol === STTApi.playerData.character.location.place)!
								.display_name
						}
					</p>

					{STTApi.fleetData && <h4>Note from your fleet ({STTApi.fleetData.name}) admiral</h4>}
					{STTApi.fleetData && <p>{STTApi.fleetData.motd}</p>}

					{STTApi.playerData.motd && STTApi.playerData.motd.title && <h4>Note from DisruptorBeam: {STTApi.playerData.motd.title}</h4>}
					{STTApi.playerData.motd && STTApi.playerData.motd.text && (
						<p
							style={{ fontSize: '0.9em' }}
							dangerouslySetInnerHTML={{ __html: STTApi.playerData.motd.text.trim().replace(/(?:\r\n|\r|\n)/g, '<br />') }}
						/>
					)}
				</div>
			</div>

			<div>
				<EventStatus onTabSwitch={props.onTabSwitch} />
				<VoyageStatus onTabSwitch={props.onTabSwitch} />
				<GauntletStatus onTabSwitch={props.onTabSwitch} />
				<ShuttleStatus onTabSwitch={props.onTabSwitch} />
				<DailyMissionStatus />
				<InventoryStatus onTabSwitch={props.onTabSwitch} />
			</div>
		</div>
	);
}

const DailyMissionStatus = (props:{}) => {
	let icon = Priority.CHECK;

	const cdata = STTApi.playerData.character;
	const dailies = cdata.daily_activities.filter(d => d.lifetime === 0);
	//const achievements = cdata.daily_activities.filter(d => d.lifetime === 1);
	//const recurring = cdata.daily_activities.filter(d => d.lifetime !== 0 && !d.lifetime);

	const fleetUnclaimed = cdata.fleet_activities.filter(act => act.milestones.some(m => m.claimable && !m.claimed));
	const fleetIncomplete = cdata.fleet_activities.filter(act => act.milestones.some(m => !m.claimable && !m.claimed));
	const fleetStarbaseIncmoplete = fleetIncomplete.filter(act => act.category === 'starbase_donation').length > 0;
	const canDonate = STTApi.starbaseDonationsRemaining > 0;

	const dailyRewardUnclaimed = cdata.daily_rewards_state.seconds_until_next_reward <= 0;

	if (fleetIncomplete.length > 0) {
		icon = Priority.INFO;
	}
	if (dailies.length > 0 || fleetUnclaimed.length > 0) {
		icon = Priority.EXCLAMATION;
	}

	// let cadet = STTApi.playerData.character.cadet_schedule.missions.find(m => m.id === STTApi.playerData.character.cadet_schedule.current);
	// if (STTApi.playerData.character.cadet_tickets.current === 0) {
	// 	recommendations.push({
	// 		title: 'Cadet tickets used',
	// 		icon: Priority.CHECK,
	// 		content: (
	// 			<p style={{ margin: '0' }}>
	// 				You used all cadet tickets ({STTApi.playerData.character.cadet_tickets.max}) for today's {cadet!.title}.
	// 			</p>
	// 		)
	// 	});
	// } else {
	// 	recommendations.push({
	// 		title: 'Cadet tickets remaining',
	// 		icon: Priority.HOURGLASS,
	// 		content: (
	// 			<div>
	// 				<p style={{ margin: '0' }}>
	// 					You have {STTApi.playerData.character.cadet_tickets.current} cadet tickets left for today's {cadet!.title}; it ends in{' '}
	// 					{formatTimeSeconds(STTApi.playerData.character.cadet_schedule.ends_in)}.
	// 				</p>
	// 				<p style={{ margin: '0' }}>See the 'Needed Equipment' tab for recommendations on which missions to run for items you need.</p>
	// 			</div>
	// 		)
	// 	});
	// }

	return <Recommendation title='Daily Missions' icon={icon}>
		<div style={{ margin: '0' }}>
			{ dailies.map(d => {
				const complete = d.progress === d.goal;
				const isScan = d.area === 'scan';
				return <div key={d.id}>
					{d.description}: {d.progress} / {d.goal}{complete && ' - Claim rewards in game client'}
					{(isScan && cdata.seconds_to_scan_cooldown > 0) && <div style={{marginLeft:'20px'}}>
						Next scan available in {formatTimeSeconds(cdata.seconds_to_scan_cooldown)} at {
							Moment(STTApi.lastSync).add(cdata.seconds_to_scan_cooldown, 's').format('h:mma')}
					</div>}
					{(isScan && cdata.seconds_to_scan_cooldown <= 0) && <div style={{ marginLeft: '20px' }}>
						A scan is available now
					</div>}
				</div>;
			})}
			{dailyRewardUnclaimed && <div>
				Daily Reward - Claim reward in game client
			</div>}
			{fleetUnclaimed.map(fd => {
				return <div key={fd.id}>
					Daily Fleet Reward ({fd.description}) - Claim fleet reward in game client
				</div>;
			})}
			{fleetIncomplete.length > 0 && <div>
				Some daily fleet rewards are incomplete: {
					fleetIncomplete.map(fd => fd.description + ' (' + fd.current_points + '/' + fd.total_points + ')').join(', ')}
				{ (fleetStarbaseIncmoplete && canDonate) && <div style={{ marginLeft: '20px'}}>
					You have {STTApi.starbaseDonationsRemaining} starbase donations left today. Help your fleet get their dailies!
				</div>}
			</div>}
			{dailies.length == 0 && <div>
				All personal daily missions completed and claimed
			</div>}
			<div>
				Daily activities reset in {formatTimeSeconds(cdata.next_daily_activity_reset)} at {
					Moment(STTApi.lastSync).add(cdata.next_daily_activity_reset, 's').format('h:mma')}
			</div>
		</div>
	</Recommendation>;
}

const InventoryStatus = (props: {
	onTabSwitch?: (newTab: string) => void;
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');
	let icon = Priority.CHECK;

	let replicator_uses_left = STTApi.playerData.replicator_limit - STTApi.playerData.replicator_uses_today;
	if (replicator_uses_left > 0) {
		icon = Priority.INFO;
	}

	let overflowingItems = STTApi.items.filter(item => item.quantity > 32000);
	if (overflowingItems.length > 0) {
		icon = Priority.EXCLAMATION;
	}

	let itemCount = STTApi.items.length;
	let itemCapReached = false;
	let itemCapNearing = false;
	if ((itemCount * 100) / STTApi.playerData.character.item_limit > 90) {
		itemCapNearing = true;
		icon = Priority.EXCLAMATION;
	}

	if (itemCount > STTApi.playerData.character.item_limit - 5) {
		itemCapReached = true;
		icon = Priority.EXCLAMATIONRED;
	}

	return <Recommendation title='Inventory' icon={icon}>
		{ itemCapReached && <div>
			You are over the inventory limit and are losing items
			<div style={{ margin: '0' }}>
				You have {STTApi.items.length} types of items in your inventory out of a maximum of{' '}
				{STTApi.playerData.character.item_limit}; the game is randomly dismissing items.
			</div>
			<div style={{ margin: '0' }}>
				Consider getting rid of some items by equipping, or look for
				<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Items')}>Items</Label> to replicate and use
				extras as replicator fuel.
			</div>
		</div>}
		{ itemCapNearing && <div>
			Approaching inventory limit
			<div style={{ margin: '0' }}>
				You have {STTApi.items.length} types of items in your inventory out of a maximum of{' '}
				{STTApi.playerData.character.item_limit}.
			</div>
			<div style={{ margin: '0' }}>
			Consider getting rid of some items by equipping, or look for
				<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Items')}>Items</Label> to replicate and use
				extras as replicator fuel.
			</div>
		</div>}
		{ overflowingItems.length > 0 && <div>
			<div style={{ margin: '0' }}>
				Some of your items are overflowing; the item quantity is capped at 32768 by the game, and any extras are lost:
			</div>
			<div style={{ display: 'flex' }}>
				{overflowingItems.map((item, idx) => (
					<span style={{ display: 'contents' }} key={idx}>
						<ItemDisplay src={STTApi.imgUrl(item.icon, imageCacheUpdated)} size={24} maxRarity={item.rarity} rarity={item.rarity} /> {item.name} ({item.quantity}){' '}
					</span>
				))}
			</div>
		</div>}
		{ (replicator_uses_left === 0) && <div style={{ margin: '0' }}>
			You have used all of your replicator rations ({STTApi.playerData.replicator_limit}) for today.
		</div>}
		{ (replicator_uses_left > 0) && <div style={{ margin: '0' }}>
			You have {replicator_uses_left} replicator uses left for today. See
			the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('NeededEquipment')}>Needed Equipment</Label> tab
			for recommendations on what to spend them on or look for
			<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Items')}>Items</Label> to replicate.
		</div>}
		{(!itemCapReached && !itemCapNearing) && <div>
			<div style={{ margin: '0' }}>
				Your invetory count is at {STTApi.items.length} out of a maximum of {STTApi.playerData.character.item_limit}.
			</div>
		</div>}
	</Recommendation>;
}

const EventStatus = (props: {
	onTabSwitch?: (newTab: string) => void;
}) => {
	if (!STTApi.playerData.character.events ||
		STTApi.playerData.character.events.length === 0 ||
		!STTApi.playerData.character.events[0].content) {
			return <span />;
	}

	let eventData = STTApi.playerData.character.events[0];

	//TODO: check event start time and change icon
	let hasStarted = eventData.seconds_to_start <= 0;
	let hasEnded = eventData.seconds_to_end <= 0;
	let msg = '';
	if (hasEnded) {
		msg = ' has ended and has rewards to collect in-game';
	} else if (hasStarted) {
		msg = ' has started and ends in ' + formatTimeSeconds(eventData.seconds_to_end);
	} else {
		msg = ' starts in ' + formatTimeSeconds(eventData.seconds_to_start);
	}

	let title = 'Event ' + msg;
	let icon = Priority.INFO;
	let knownType = true;

	if (eventData.content.content_type === EVENT_TYPES.SHUTTLES) {
		title = 'Faction Event ' + msg;
	}
	else if (eventData.content.content_type === EVENT_TYPES.GATHER) {
		title = `Supply Event ` + msg;
	}
	else if (eventData.content.content_type === EVENT_TYPES.SKIRMISH) {
		title = `Skirmish Event ` + msg;
	}
	else if (eventData.content.content_type === EVENT_TYPES.EXPEDITION) {
		title = `Expedition Event ` + msg;
	}
	else {
		knownType = false;
	}

	return <Recommendation title={title} icon={icon}>
		<div style={{ margin: '0' }}>
			{(!hasEnded && knownType) &&
				<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Events')}>Event Details</Label>
			}
		</div>
	</Recommendation>;
}

const VoyageStatus = (props: {
	onTabSwitch?: (newTab: string) => void;
}) => {
	const [status, setStatus] = React.useState<{title: string, icon: string, content: React.ReactNode}>({
		title: 'Checking voyage status...',
		icon: Priority.HOURGLASS,
		content: <span/>
	});

	React.useEffect(() => {
		loadVoyageStatus();
	}, []);

	return <Recommendation title={status.title} icon={status.icon}>
		{status.content}
	</Recommendation>;

	async function loadVoyageStatus() {
		if (STTApi.playerData.character.voyage.length === 0) {
			setStatus({
				title: 'No voyage running',
				icon: Priority.EXCLAMATION,
				content: <p style={{ margin: '0' }}>
					Start a voyage in the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>Voyage
					</Label> tab to collect rewards.</p>
			});
		} else {
			try {
				await loadVoyage(STTApi.playerData.character.voyage[0].id, true);
			} catch (err) {
				// Failed to load voyage with this ID; notify the user to refresh; need to get updates to crew on the voyage
				// anyway so they can be selected for the new one
				setStatus({
					title: 'Voyage lookup failed - Reload data and then start a voyage',
					icon: Priority.EXCLAMATION,
					content: <p style={{ margin: '0' }}>
						Start a voyage in the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>Voyage
					</Label> tab to collect rewards.</p>
				});
				return;
			}
			let newRecommendation = undefined;
			let voyage = STTApi.playerData.character.voyage[0];

			if (voyage.state === 'recalled') {
				if (voyage.recall_time_left! > 0) {
					const narrative = await loadVoyage(STTApi.playerData.character.voyage[0].id, false);
					setStatus({
						title: `Voyage returning`,
						icon: Priority.CHECK,
						content: (
							<p style={{ margin: '0' }}>
								<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>Voyage
								</Label> ran for {formatTimeSeconds(voyDuration(narrative))} and it's currently returning (
								{formatTimeSeconds(voyage.recall_time_left)} at {Moment(STTApi.lastSyncVoyage).add(voyage.recall_time_left, 's').format('h:mma')}).
							</p>
						)
					});
				} else {
					setStatus({
						title: 'Voyage has returned',
						icon: Priority.EXCLAMATION,
						content: <p style={{ margin: '0' }}>The <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>voyage
							</Label> is back. Claim your rewards in the game.</p>
					});
				}
			} else if (voyage.state === 'failed') {
				setStatus({
					title: `Voyage failed`,
					icon: Priority.EXCLAMATIONRED,
					content: (
						<p style={{ margin: '0' }}>
							Voyage has run out of antimatter after {formatTimeSeconds(voyage.voyage_duration)} and it's waiting to be abandoned or
							replenished.
						</p>
					)
				});
			} else if (voyage.seconds_between_dilemmas === voyage.seconds_since_last_dilemma) {
				setStatus({
					title: 'Voyage is waiting on your dilemma decision',
					icon: Priority.EXCLAMATION,
					content: <p style={{ margin: '0' }}>Resolve the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>Voyage
						</Label> dilemma.</p>
				});
			} else {
				const secondsToNextDilemma = voyage.seconds_between_dilemmas - voyage.seconds_since_last_dilemma;
				const estSecondsLeft = voyage.hp / VOYAGE_AM_DECAY_PER_MINUTE * 60;
				// TODO: check the chances to reach a dilemma and go red if 0%
				setStatus({
					title: `Voyage ongoing`,
					icon: Priority.CHECK,
					content: (
						<div style={{ margin: '0' }}>
							<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>Voyage</Label>
							&nbsp;has been
							ongoing for {formatTimeSeconds(voyage.voyage_duration)} (new dilemma in{' '}
							{formatTimeSeconds(secondsToNextDilemma)}
							&nbsp;at {Moment(STTApi.lastSyncVoyage).add(secondsToNextDilemma, 's').format('h:mma')})
							{
								(estSecondsLeft < secondsToNextDilemma) &&
								<span style={{ fontWeight: 'bold' }}>
									&nbsp;Voyage AM left ({voyage.hp}) might not be enough to reach the next dilemma.
									&nbsp;By worst-case estimate, voyage loss in {formatTimeSeconds(estSecondsLeft)}
									&nbsp;at {Moment(STTApi.lastSyncVoyage).add(estSecondsLeft, 's').format('h:mma')}
								</span>
							}
						</div>
					)
				});
			}
		}
	}
}

const GauntletStatus = (props: {
	onTabSwitch?: (newTab: string) => void;
}) => {
	const [status, setStatus] = React.useState<{ title: string, icon: string, content: React.ReactNode }>({
		title: 'Checking gauntlet status...',
		icon: Priority.HOURGLASS,
		content: <span />
	});

	React.useEffect(() => {
		loadGauntletStatus();
	}, []);

	return <Recommendation title={status.title} icon={status.icon}>
		{status.content}
	</Recommendation>;

	function loadGauntletStatus() {
		loadGauntlet().then(gauntlet => {
			if (gauntlet.state === 'NONE') {
				setStatus({
					title: 'Start a gauntlet',
					icon: Priority.EXCLAMATION,
					content: (
						<div style={{ margin: '0' }}>
							You're not currently in a gauntlet; join one in
							the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Gauntlet')}>Gauntlet</Label> tab, you're missing out on rewards. Next gauntlet starts in{' '}
							{formatTimeSeconds(gauntlet.seconds_to_join)}.
						</div>
					)
				});
			} else if (gauntlet.state === 'ENDED_WITH_REWARDS') {
				setStatus({
					title: `Gauntlet has ended (your rank is ${gauntlet.rank})`,
					icon: Priority.EXCLAMATION,
					content: <div style={{ margin: '0' }}>The gauntlet has ended; claim your rewards in the game or in
					the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Gauntlet')}>Gauntlet</Label> tab.</div>
				});
			} else if (gauntlet.state === 'STARTED') {
				const anyEnabled = gauntlet.contest_data.selected_crew.some(c => !c.disabled);
				setStatus({
					title: 'Gauntlet is active',
					icon: anyEnabled ? Priority.HOURGLASS : Priority.INFO,
					content: (
						<div style={{ margin: '0' }}>
							{
								anyEnabled && `Some crew still available to compete. `
							}
							{
								!anyEnabled && `No crew available to compete. `
							}
							The <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Gauntlet')}>Gauntlet</Label> ends
							in {formatTimeSeconds(gauntlet.seconds_to_end)}, next crew refresh in{' '}
							{formatTimeSeconds(gauntlet.seconds_to_next_crew_refresh)}
							{' '}at {Moment(STTApi.lastSyncGauntlet).add(gauntlet.seconds_to_next_crew_refresh, 's').format('h:mma')}.
						</div>
					)
				});

				// TODO: check if crew is unused (debuff 0)
			} else {
				setStatus({
					title: 'Gauntlet state undefined: ' + gauntlet.state,
					icon: Priority.EXCLAMATION,
					content: <span/>
				});
			}
		});
	}
}

const ShuttleStatus = (props:{
	onTabSwitch?: (newTab: string) => void;
}) => {
	let statusIcon = Priority.INFO;
	let unusedCount = STTApi.playerData.character.shuttle_bays - STTApi.playerData.character.shuttle_adventures.length;
	let returned : PlayerShuttleDTO[] = [];
	let active: PlayerShuttleDTO[] = [];
	let other: PlayerShuttleDTO[] = [];
	let opened: PlayerShuttleDTO[] = [];
	let shuttles = STTApi.playerData.character.shuttle_adventures.map(sa => sa.shuttles[0]);

	if (unusedCount > 0) {
		statusIcon = Priority.QUESTION;
	}
	if (shuttles.length > 0) {
		opened = shuttles.filter(sa => sa.state === SHUTTLE_STATE_OPENED);
		if (opened.length > 0) {
			statusIcon = Priority.HOURGLASS;
		}
		returned = shuttles.filter(sa => sa.state === SHUTTLE_STATE_COMPLETE);
		if (returned.length > 0) {
			statusIcon = Priority.EXCLAMATION;
		}
		active = shuttles.filter(sa => sa.state === SHUTTLE_STATE_INPROGRESS);
		other = shuttles.filter(sa => sa.state !== SHUTTLE_STATE_INPROGRESS && sa.state !== SHUTTLE_STATE_COMPLETE);
	}

	return <Recommendation title='Shuttles' icon={statusIcon}>
		<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Shuttles')}>Shuttles page</Label>
		{unusedCount > 0 && <div>
			<div style={{ margin: '0' }}>
				Idle Shuttles ({unusedCount}): You have {unusedCount} shuttle(s) idling instead of out bringing goodies.
			</div>
			<div style={{ margin: '0', marginLeft:'20px' }}>
				See the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('NeededEquipment')}>Needed Equipment</Label> tab
				for recommendations on best factions to send your shuttles for.
			</div>
		</div>}
		{returned.length > 0 && <div style={{ margin: '0' }}>
			Returned ({returned.length}): (
			{returned
				.map(sa => sa.name)
				.join(', ')}
			) Go into the game to collect your rewards and send them back out!
		</div>}
		{active.length > 0 && <div style={{ margin: '0' }}>
			Active Shuttles ({active.length}):{' '}
			{active.sort((a, b) => a.expires_in - b.expires_in)
				.map((sa, index: number) => (
					<div key={sa.id}>
						{sa.name} (Completes in {formatTimeSeconds(sa.expires_in)}
						{' '}at {Moment(STTApi.lastSync).add(sa.expires_in, 's').format('h:mma')})
						{(index === active.length - 1) ? '' : ', '}
					</div>
				))
			}
		</div>}
		{other.length > 0 && <div style={{ margin: '0' }}>
			Other Shuttles ({other.length}):{' '}
			{other.sort((a, b) => a.expires_in - b.expires_in)
				.map((sa, index: number) => (
					<div key={sa.id}>
						{sa.name} - {SHUTTLE_STATE_NAMES[sa.state] || SHUTTLE_STATE_NAME_UNKNOWN} ({formatTimeSeconds(sa.expires_in)}
						{' '}at {Moment(STTApi.lastSync).add(sa.expires_in, 's').format('h:mma')})
						{(index === active.length - 1) ? '' : ', '}
					</div>
				))
			}
		</div>}
	</Recommendation>;
}
