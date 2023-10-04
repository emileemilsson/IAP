import React from 'react';

import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';

import UserStore from '../Styles';

import STTApi, { CONFIG, loadVoyage, formatTimeSeconds } from '../../api';
import { VoyageDTO, VoyageNarrativeDTO } from '../../api/DTO21';
import { DefaultButton } from 'office-ui-fabric-react/lib/Button';

export interface ShuttleAdventureProps {
	activeId?: any;
}

export const ShuttleAdventure = (props:ShuttleAdventureProps) => {
	let name = '';
	let description = '';
	let completes_in_seconds = 0;
	let challenge_rating = undefined;
	let factionIcon : string | undefined = '';
	let factionName = '';
	let factionCompleted = 0;

	STTApi.playerData.character.shuttle_adventures.forEach((shuttle) => {
		if (shuttle.shuttles[0].id === props.activeId) {
			name = shuttle.shuttles[0].name;
			description = shuttle.shuttles[0].description;
			completes_in_seconds = shuttle.shuttles[0].expires_in;
			challenge_rating = shuttle.challenge_rating;
			let faction = STTApi.playerData.character.factions.find((faction) => faction.id === shuttle.faction_id);
			if (faction) {
				factionIcon = STTApi.imgUrl(faction.reputation_item_icon, undefined);
				factionName = faction.name;
				factionCompleted = faction.completed_shuttle_adventures;
			}
		}
	});

	return (<div>
		<table>
			<tbody>
				<tr>
					<td style={{ width: '150px' }} >
						<img src={CONFIG.SPRITES['icon_shuttle_lg'].url} />
					</td>
					<td style={{ verticalAlign: 'center' }} >
						<h3>{name}</h3>
					</td>
					<td>
						<img src={factionIcon} style={{ height: '80px' }} />
					</td>
				</tr>
				<tr>
					<td colSpan={3}>
						<h4>{description}</h4>
					</td>
				</tr>
			</tbody>
		</table>
		<p>Completes in {formatTimeSeconds(completes_in_seconds)}.</p>
		<p>Faction: {factionName} ({factionCompleted} completed adventures)</p>
		<p>Challenge rating: {challenge_rating}.</p>
	</div>);
}

const VoyageLogEntry = (props:{
	log: VoyageNarrativeDTO[];
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');
	let iconUrlMap : any = {};
	props.log.forEach(entry=> {
		// TODO: some log entries have 2 crew
		if (entry.crew) {
			let rc = STTApi.roster.find((rosterCrew) => rosterCrew.symbol == entry.crew![0]);
			if (rc) {
				iconUrlMap[entry.crew[0]] = STTApi.imgUrl(rc.portrait, imageCacheUpdated);
			}
		}
	});

	return (<ul>
		{props.log.map((entry, index) =>
			<li key={index}>
				<span className='quest-mastery'>
					{entry.skill_check && (
						<span className='quest-mastery'>
							<img src={CONFIG.SPRITES['icon_' + entry.skill_check.skill].url} height={18} />
							<i className={`thumbs ${entry.skill_check.passed ? 'up' : 'down'} outline icon`}></i>
							&nbsp;
						</span>
					)}
					{entry.crew && iconUrlMap[entry.crew![0]] && (
						<img src={iconUrlMap[entry.crew![0]]} height={32} />
					)}
					<span dangerouslySetInnerHTML={{__html: entry.text}} />
				</span>
			</li>
		)}
	</ul>);
}

const Voyage = (props:{
	activeId: number;
}) => {
	let [loaded, setLoaded] = React.useState({} as { done: boolean, currVoyage: VoyageDTO, currVoyageNarr?: VoyageNarrativeDTO[][]});
	const [, imageCacheUpdated] = React.useState<string>('');

	//TODO: if narrative is not displayed, no need to load it here
	React.useEffect(() => {
		STTApi.playerData.character.voyage.forEach((voyage) => {
			if (voyage.id == props.activeId) {
				loadVoyage(voyage.id, false).then((voyageNarrative) => {

					// Group by index
					// let voyageNarrative2 = voyageNarrative.reduce(function (r, a) {
					//     r[a.index] = r[a.index] || [];
					//     r[a.index].push(a);
					//     return r;
					// }, Object.create(null));

					setLoaded({
						done: true,
						currVoyage: voyage,
						// currVoyageNarr: voyageNarrative2
					})
				});
			}
		});
	}, []);

	let {done, currVoyage } = loaded;

	function renderVoyageState() {
		if (currVoyage.state == "recalled") {
			return <p>Voyage has lasted for {formatTimeSeconds(currVoyage.voyage_duration)} and it's currently returning.</p>;
		} else if (currVoyage.state == "failed") {
			return <p>Voyage has run out of antimatter after {formatTimeSeconds(currVoyage.voyage_duration)} and it's waiting to be abandoned or replenished.</p>;
		} else {
			return <p>Voyage has been ongoing for {formatTimeSeconds(currVoyage.voyage_duration)} (new dilemma in {formatTimeSeconds(currVoyage.seconds_between_dilemmas - currVoyage.seconds_since_last_dilemma)}).</p>;
		}
	}

	if (!done) {
		return <div className="ui big centered text active inline loader">Loading voyage details...</div>;
	}

	return (<div style={{ userSelect: 'initial' }}>
		<h3>Voyage on the {STTApi.getShipTraitName(currVoyage.ship_trait)} ship {currVoyage.ship_name}</h3>
		{renderVoyageState()}
		<p>Antimatter remaining: {currVoyage.hp} / {currVoyage.max_hp}.</p>
		<table style={{ borderSpacing: '0' }}>
			<tbody>
				<tr>
					<td>
						<section>
							<h4>Full crew complement and skill aggregates</h4>
							<ul>
								{currVoyage.crew_slots.map((slot) => {
									return (<li key={slot.symbol}><span className='quest-mastery'>
										{slot.name} &nbsp; <img src={ STTApi.imgUrl(slot.crew.portrait, imageCacheUpdated)} height={20} /> &nbsp; {slot.crew.name}
										</span>
									</li>);
								})}
							</ul>
						</section>
					</td>
					<td>
						<ul>
							{Object.keys(currVoyage.skill_aggregates).map(k => currVoyage.skill_aggregates[k]).map((skill) => {
								return (<li key={skill.skill}>
									<span className='quest-mastery'>
										<img src={CONFIG.SPRITES['icon_' + skill.skill].url} height={18} /> &nbsp; {skill.core} ({skill.range_min}-{skill.range_max})
									</span>
								</li>);
							})}
						</ul>
					</td>
				</tr>
			</tbody>
		</table>
		{ // This is really too much detail for a dialog here
			/* <CollapsibleSection title={'Pending rewards (' + currVoyage.pending_rewards.loot.length + ')'} background='#0078d7'>
			{currVoyage.pending_rewards.loot.map((loot, index, array) =>
				(<span key={index} style={{ color: loot.rarity ? CONFIG.RARITIES[loot.rarity].color : '' }}
					>{loot.quantity} {loot.rarity ? CONFIG.RARITIES[loot.rarity].name : ''} {loot.full_name}{
						index == array.length -1 ? '' : ', '
					}</span>)
			)}
		</CollapsibleSection>
		<CollapsibleSection title={'Complete Captain\'s Log (' + Object.keys(currVoyageNarr).length + ')'} background='#0078d7'>
			{ Object.keys(currVoyageNarr).forEach((narrByIndex, key) => {
				let v = currVoyageNarr[key];
				return <VoyageLogEntry key={key} log={v}/>;
			})}
		</CollapsibleSection> */}
	</div>);
}

export const ActiveCrewDialog = (props: {
	activeId?: number;
	name?: string;
}) => {
	let [activeId, setActiveId] = React.useState(props.activeId);

	//FIXME: still need to fix allowing this dialog to close
	React.useEffect(() => {
		setActiveId(props.activeId);
	}, [props.activeId]);

	let shuttle = undefined;
	let title = 'Active crew status';

	if (activeId) {
		shuttle = STTApi.playerData.character.shuttle_adventures.find((sh) => sh.shuttles[0].id == activeId);
		title = props.name + (shuttle ? ' is on a shuttle adventure' : ' is on a voyage');
	}

	const closeDialog = () => setActiveId(undefined);

	let currentTheme = UserStore.get('theme');

	return <Dialog
		hidden={activeId === undefined}
		title={title}
		onDismiss={closeDialog}
		dialogContentProps={{ type: DialogType.largeHeader }}
		modalProps={{
			isBlocking: false,
			containerClassName: 'activedialogMainOverride'
		}}
	>
		<div style={{ color: currentTheme.semanticColors.bodyText, backgroundColor: currentTheme.semanticColors.bodyBackground }}>
			{shuttle && props.activeId && (
				<ShuttleAdventure activeId={props.activeId} />
				)}

			{!shuttle && props.activeId && (
				<Voyage activeId={props.activeId} />
			)}
		</div>
		<DialogFooter>
			<DefaultButton onClick={closeDialog} text='Close' />
		</DialogFooter>
	</Dialog>;
}
