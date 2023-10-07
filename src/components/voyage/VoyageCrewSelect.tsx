import React from 'react';
import Moment from 'moment';
import { Message, Dropdown, Header, Select, Checkbox, Form, Image, Card, Button, DropdownItem, DropdownItemProps } from 'semantic-ui-react';

import STTApi, { CONFIG, bonusCrewForCurrentEvent, formatTimeSeconds, download, CrewSkills } from '../../api';
import { CrewData, VoyageDTO } from '../../api/DTO';
import { bestVoyageShip, startVoyage, calculateVoyage, estimateVoyageDuration, toSkillValues, calculateVoyageCrewRank } from './VoyageTools';
import { VoyageSkillsReadout, Skill } from './VoyageSkillsReadout';
import { CalcChoice, cleanCrewName } from './voyageCalc';
import { GetSpriteCssClass } from '../DarkThemeContext';

interface VoyageCrewEntry {
	key: number;
	value: number;
	image: { avatar: boolean; src: string | undefined; };
	text: string;
}

export const VoyageCrewSelect = (props: {
	onRefreshNeeded: () => void;
}) => {
	const [error, setError] = React.useState(undefined as string | undefined);
	const [generatingVoyCrewRank, setGeneratingVoyCrewRank] = React.useState(false);
	const [searchDepth, setSearchDepth] = React.useState(6);
	const [extendsTarget, setExtendsTarget] = React.useState(0);
	const [includeFrozen, setIncludeFrozen] = React.useState(false);
	const [includeActive, setIncludeActive] = React.useState(false);
	const [shipName, setShipName] = React.useState(undefined as string | undefined);
	const [, imageCacheUpdated] = React.useState<string>('');
	const spriteClass = GetSpriteCssClass();

	const initialCalcState = {
		estimatedDuration: undefined,
		state: 'open',
		crewSelection: []
	} as {
		estimatedDuration: number | undefined,
		state: string,
		crewSelection: CalcChoice[]
	}

	const [calcState, setCalcState] = React.useState(initialCalcState);

	React.useEffect(() => {
		if (calcState.state === 'open') {
			calcVoyageLength();
		}
	}, [calcState]);

	let bestVoyageShips = bestVoyageShip();
	const [bestShips, setBestShips] = React.useState(bestVoyageShips);
	const [selectedShipId, setSelectedShipId] = React.useState(bestVoyageShips[0].ship.id as number | undefined);

	let peopleListVal: VoyageCrewEntry[] = [];
	STTApi.roster.forEach(crew => {
		if (includeFrozen || crew.status.frozen <= 0) {
			peopleListVal.push({
				key: crew.crew_id || crew.id,
				value: crew.crew_id || crew.id,
				image: { avatar: true, src: STTApi.imgUrl(crew.portrait, imageCacheUpdated) },
				text: crew.name
			});
		}
	});
	peopleListVal.sort((a, b) => (a.text < b.text) ? -1 : ((a.text > b.text) ? 1 : 0));
	//const [peopleList, setPeopleList] = React.useState(peopleListVal);
	const peopleList = peopleListVal;

		// See which crew is needed in the event to give the user a chance to remove them from consideration
	let result = bonusCrewForCurrentEvent(includeFrozen);
	//const [activeEvent, setActiveEvent] = React.useState(result ? result.eventName : undefined);
	const activeEvent = result ? result.eventName : undefined;
	const [currentSelectedItems, setCurrentSelectedItems] = React.useState(result ? result.crewIds : []);

	React.useEffect(() => {
		let result = bonusCrewForCurrentEvent(includeFrozen);
		setCurrentSelectedItems(result ? result.crewIds : []);
	}, [includeFrozen]);

	// function getIndexBySlotName(slotName: any) : number | undefined {
	//     const crewSlots = STTApi.playerData.character.voyage_descriptions[0].crew_slots;
	//     for (let slotIndex = 0; slotIndex < crewSlots.length; slotIndex++) {
	//         if (crewSlots[slotIndex].name === slotName) {
	//             return slotIndex;
	//         }
	//     }
	// }

	let shipSpans = [];
	for (let entry of bestShips) {
		shipSpans.push({
			key: entry.ship.id,
			text: entry.ship.name,
			value: entry.ship.id,
			content: (
				<Header
					icon={<img src={STTApi.imgUrl(entry.ship.icon, imageCacheUpdated)} height={48} style={{ display: 'inline-block' }} />}
					content={entry.ship.name}
					subheader={`${entry.score.toFixed(0)} antimatter`}
				/>
			)
		});
	}

	let currentPrimarySkillUrl;
	let currentSecondarySkillUrl;
	if (STTApi.playerData.character.voyage_descriptions && STTApi.playerData.character.voyage_descriptions.length > 0) {
		currentPrimarySkillUrl = CONFIG.SPRITES[`icon_${STTApi.playerData.character.voyage_descriptions[0].skills.primary_skill}`].url;
		currentSecondarySkillUrl = CONFIG.SPRITES[`icon_${STTApi.playerData.character.voyage_descriptions[0].skills.secondary_skill}`].url;
	}
	let voyage: VoyageDTO | undefined = undefined;
	if (STTApi.playerData.character.voyage && STTApi.playerData.character.voyage.length > 0) {
		voyage = STTApi.playerData.character.voyage[0];
		currentPrimarySkillUrl = CONFIG.SPRITES[`icon_${voyage.skills.primary_skill}`].url;
		currentSecondarySkillUrl = CONFIG.SPRITES[`icon_${voyage.skills.secondary_skill}`].url;
	}

	const estDurationSec = (calcState.estimatedDuration ?? 0) * 60 * 60;
	const estRecallDurationSec = 0.4 * (estDurationSec);
	return (
		<div>
			<h1>Start Voyage</h1>
			<Message attached>
				<div className='voyage-skillsets'>
					<div>Primary:</div>
					<div><img className={`image-fit ${spriteClass}`} src={currentPrimarySkillUrl} /></div>
					<div>Secondary:</div>
					<div><img className={`image-fit ${spriteClass}`} src={currentSecondarySkillUrl} /></div>
				</div>
				<div>Configure the settings below, then click on the "Calculate" button to see the recommendations.</div>
			</Message>
			<Form className='attached fluid segment' loading={generatingVoyCrewRank || calcState.state === 'inprogress'}>
				<Form.Group inline>
					<Form.Field
						control={Select}
						label='Search depth'
						options={[
							{ key: '4', text: '4 (fastest)', value: 4 },
							{ key: '5', text: '5 (faster)', value: 5 },
							{ key: '6', text: '6 (normal)', value: 6 },
							{ key: '7', text: '7 (slower)', value: 7 },
							{ key: '8', text: '8 (slowest)', value: 8 },
							{ key: '9', text: '9 (for supercomputers)', value: 9 }
						]}
						value={searchDepth}
						onChange={(e: any, { value }: any) => setSearchDepth(value)}
						placeholder='Search depth'
					/>
					<Form.Field
						control={Select}
						label='Extends (target)'
						options={[
							{ key: '0', text: 'none (default)', value: 0 },
							{ key: '1', text: 'one', value: 1 },
							{ key: '2', text: 'two', value: 2 }
						]}
						value={extendsTarget}
						onChange={(e:any, { value }:any) => setExtendsTarget(value)}
						placeholder='How many times you plan to revive'
					/>
				</Form.Group>

				<Form.Group inline>
					<Form.Field>
						<label>Choose a ship (Bonus: {STTApi.playerData.character.voyage_descriptions[0].ship_trait})</label>
						<Dropdown
							className='ship-dropdown'
							selection
							options={shipSpans}
							placeholder='Choose a ship for your voyage'
							value={selectedShipId}
							onChange={(ev, { value }) => setSelectedShipId(value !== undefined ? +value : undefined)}
						/>
					</Form.Field>

					<Form.Input
						label='Ship name'
						value={shipName}
						placeholder={bestShips.find((s) => s.ship.id == selectedShipId)!.ship.name}
						onChange={(ev, { value }) => setShipName(value)}
					/>
				</Form.Group>

				<Form.Group>
					<Form.Field
						control={Dropdown}
						clearable
						fluid
						multiple
						search
						selection
						options={peopleList}
						placeholder='Select or search for crew'
						label={
							"Crew you don't want to consider for voyage" +
							(activeEvent ? ` (preselected crew which gives bonus in the event ${activeEvent})` : '')
						}
						value={currentSelectedItems}
						onChange={(e: any, { value }: any) => setCurrentSelectedItems(value)}
					/>
				</Form.Group>

				<Form.Group inline>
					<Form.Field
						control={Checkbox}
						label='Include active (on shuttles) crew'
						checked={includeActive}
						onChange={(e: any, { checked }: any) => setIncludeActive(checked)}
					/>

					<Form.Field
						control={Checkbox}
						label='Include frozen (vaulted) crew'
						checked={includeFrozen}
						onChange={(e: any, { checked }: any) => setIncludeFrozen(checked)}
					/>
				</Form.Group>

				{(calcState.state === 'inprogress' || calcState.state === 'done') && (<>
					<h3>
						Estimated duration: <b>{formatTimeSeconds(estDurationSec)}</b>
					</h3>
					<h5>
					Including recall: {formatTimeSeconds(estDurationSec + estRecallDurationSec)} at {
					Moment().add(estDurationSec + estRecallDurationSec, 's').format('h:mma')}
					</h5>
					</>
				)}

				<Form.Group>
					<Form.Button primary onClick={_calcVoyageData} disabled={calcState.state === 'inprogress'}>
						Calculate best crew selection
					</Form.Button>
					{/* #!if allowPush == true */}
					<Form.Button secondary onClick={_startVoyage} disabled={calcState.state !== 'done' || voyage !== undefined}>
						Start voyage with recommendations
					</Form.Button>
					{/* #!endif */}

					<Form.Button onClick={() => _generateVoyCrewRank()} disabled={calcState.state === 'inprogress'}>
						Export CSV with crew Voyage ranking...
					</Form.Button>
				</Form.Group>
			</Form>
			<Message attached='bottom' error hidden={!error}>
				Error: {error}
			</Message>

			<BestCrew
				state={calcState.state}
				crewSelection={calcState.crewSelection}
				crewAvailable={getAvailableCrew()}
				crewUpdated={crewSelectionChanged} />
		</div>
	);

	function crewSelectionChanged(selection: CalcChoice[]) {
		setCalcState({
			crewSelection: selection,
			estimatedDuration: 0,
			state: 'open'
		});
	}

	// #!if allowPush == true
	function _startVoyage() {
		let selectedCrewIds = [];
		for (let i = 0; i < STTApi.playerData.character.voyage_descriptions[0].crew_slots.length; i++) {
			let entry = calcState.crewSelection.find((entry) => entry.slotId === i);
			if (!entry) {
				setError(`Cannot start voyage with unknown crew slot '${i}'`);
				return;
			}

			if (!entry.choice.crew_id || entry.choice.active_id) {
				setError(`Cannot start voyage with frozen or active crew '${entry.choice.name}'`);
				return;
			}

			selectedCrewIds.push(entry.choice.crew_id);
		}

		if (!selectedShipId) {
			setError(`Cannot start voyage without a selected ship`);
			return;
		}

		startVoyage(
			STTApi.playerData.character.voyage_descriptions[0].symbol,
			selectedShipId,
			shipName,
			selectedCrewIds
		)
			.then(() => {
				props.onRefreshNeeded();
			})
			.catch(err => {
				setError(err.message);
			});
	}
	// #!endif

	function getAvailableCrew() {
		return STTApi.roster.filter(crew => {
			// Filter out buy-back crew
			if (crew.buyback) {
				return false;
			}

			if (!includeActive && crew.active_id) {
				return false;
			}

			if (!includeFrozen && crew.frozen > 0) {
				return false;
			}

			// Filter out crew the user has chosen not to include
			if (
				currentSelectedItems.length > 0 &&
				currentSelectedItems.some((ignored) => ignored === (crew.crew_id || crew.id))
			) {
				return false;
			}

			return true;
		});
	}

	function _calcVoyageData() {
		calculateVoyage(
			{
				roster: getAvailableCrew(),
				vd: STTApi.playerData.character.voyage_descriptions[0],
				shipAM: bestShips.find((s) => s.ship.id == selectedShipId)!.score,
			},
			(entries: CalcChoice[], score: number) => {
				setCalcState({
					crewSelection: entries,
					estimatedDuration: score,
					state: 'inprogress'
				});
			},
			(entries: CalcChoice[], score: number) => {
				setCalcState({
					crewSelection: entries,
					estimatedDuration: score,
					state: 'done'
				});
			}
		);
	}

	function calcVoyageLength() {
		const vd = STTApi.playerData.character.voyage_descriptions[0];
		if (calcState.crewSelection.length < vd.crew_slots.length) {
			return;
		}
		const assignedRoster: CrewData[] = calcState.crewSelection.map(cs => cs.choice);
		if (assignedRoster.length == 0) {
			console.log('Unable to estimate; roster is empty');
			return;
		}

		const amStart = bestShips.find((s) => s.ship.id == selectedShipId)!.score;

		setCalcState({
			crewSelection: calcState.crewSelection,
			estimatedDuration: calcState.estimatedDuration,
			state: 'inprogress'
		});

		const svs = toSkillValues(calcState.crewSelection, vd)

		estimateVoyageDuration(vd.skills.primary_skill, vd.skills.secondary_skill, svs, 0, amStart, false, (minutesLeft) => {
			setCalcState({
				crewSelection: calcState.crewSelection,
				estimatedDuration: minutesLeft / 60,
				state: 'done'
			});
		});
	}

	function _generateVoyCrewRank() {
		function nthIndex(str:string, pat:string, n:number) {
			let L = str.length, i = -1;
			while (n-- && i++ < L) {
				i = str.indexOf(pat, i);
				if (i < 0) break;
			}
			return i;
		}

		setGeneratingVoyCrewRank(true);

		calculateVoyageCrewRank(
			{
				vd: STTApi.playerData.character.voyage_descriptions[0],
				roster: getAvailableCrew(),
				shipAM: bestShips.find((s) => s.ship.id == selectedShipId)!.score
			},
			(rankResult: string, estimateResult: string) => {
				// estimateResult is of the form "Primary,Secondary,Estimate,Crew\nDIP, CMD, 8.2, crew1 | crew2 | crew3 | crew4 | crew5 | ... crew12\nCMD, DIP, 8.2, crew1 | ... "
				// crew names may have spaces, commas, and single or double quotes
				let lines = estimateResult.split('\n');
				let estimateResultSplit = "";
				lines.forEach((line: string,index:number) => {
					// skip column headers line
					if (index <= 0) {
						estimateResultSplit += line + '\n';
						return;
					}
					if (line.trim().length <= 0) {
						return;
					}
					let posEst = nthIndex(line, ',', 2);
					let posNames = nthIndex(line, ',', 3);
					let est = line.substring(posEst+1, posNames);
					let estN = Number(est);
					if (!isNaN(estN)) {
						est = formatTimeSeconds(estN * 60 * 60)
					}
					let crewline = line.substring(posNames+1);
					let crewlist = crewline.split('|');

					function cleanCrewName(name: string) : string {
						return name.replace(/[^\x00-\x7F]/g, "").replace(/"/g, "'")
					}

					crewlist = crewlist.map(s => cleanCrewName(s.trim()));// don't sort so you can see position assignments //.sort();

					estimateResultSplit += line.substring(0, posEst) + ',' + est + ', "' + crewlist.join(' | ') + '"\n'; // join back with pipe to make easier equations
				});

				setGeneratingVoyCrewRank(false);

				// Now also update rankResult to add crew usage value column
				// Format is: "Score,Alt 1,Alt 2,Alt 3,Alt 4,Alt 5,Status,Crew,Voyages (Pri),Voyages(alt)"
				let linesCrew = rankResult.split('\n');
				let rankResultSplit = "";
				let includedCrew : { [cid:number]: CrewData } = {};
				linesCrew.forEach((line:string, index:number) => {
					let posName = nthIndex(line, ',', 7);
					let partA = line.substring(0, posName);
					let partB = line.substring(posName);
					// If first line of titles
					if (index <= 0) {
						rankResultSplit += partA + ",Value" + partB + '\n';
						return;
					}

					let posStatus = nthIndex(line, ',', 6);
					partA = line.substring(0, posStatus);
					//let partB = line.substring(posName);


					let value : string | number = "";
					let status : string | number = line.substring(posStatus +1, posName);
					// Crew name should be in double quotes after a comma within partB
					let posNameEnd = partB.indexOf('"',2);
					if (posNameEnd > 0) {
						let crewName = partB.substring(2, posNameEnd);
						let crew = STTApi.roster.find(crew => cleanCrewName(crew.name) == crewName);
						if (crew && crew.usage_value !== undefined) {
							value = crew.usage_value;
						}
						if (crew) {
							includedCrew[crew.id] = crew;
							status = crew.rarity == crew.max_rarity ? crew.max_rarity : (crew.rarity + '/' + crew.max_rarity);
							if (crew.frozen > 0)
								status += 'Frz';
							else if (crew.level == 100 && crew.rarity == crew.max_rarity)
								status += 'Imm';
						}
					}

					rankResultSplit += partA + ',' + status + ',' + value + partB + '\n'; // join back with pipe to make easier equations
				});

				// Inject any crew with a usage value but no voyage score
				STTApi.roster.sort((a,b) => {
					let v = b.usage_value - a.usage_value;
					if (v != 0) {
						return v;
					}
					let r = b.max_rarity - a.max_rarity;
					if (r != 0) {
						return r;
					}
					r = b.rarity - a.rarity;
					if (r != 0) {
						return r;
					}
					return a.name.localeCompare(b.name);
				}).forEach(crew => {
					if (!includedCrew[crew.id]) {
						if (crew.buyback || crew.isExternal || crew.usage_value === undefined)
							return;
						if (crew.usage_value > 0 || crew.frozen === 0) {
							includedCrew[crew.id] = crew;
							let status : string | number = crew.rarity == crew.max_rarity ? crew.max_rarity : (crew.rarity + '/' + crew.max_rarity);
							if (crew.frozen > 0)
								status += 'Frz';
							else if (crew.level == 100 && crew.rarity == crew.max_rarity)
								status += 'Imm';
							else if (crew.level < 100)
								status += ':' + crew.level;

							rankResultSplit += '0,,,,,,' + status + ',' + crew.usage_value + ',"' +cleanCrewName(crew.name)+'",,\n';
						}
					}
				});

				download('My Voyage Crew.csv', rankResultSplit, 'Export Star Trek Timelines voyage crew ranking', 'Export');
				download('My Voyage Estimates.csv', estimateResultSplit, 'Export Star Trek Timelines voyage estimates', 'Export');
			}
		);
	}
}

const BestCrew = (props : {
	state: string,
	crewSelection: CalcChoice[],
	crewAvailable: CrewData[],
	crewUpdated: (selection: CalcChoice[]) => void
}) => {
	const [selectSlotId, setSelectSlotId] = React.useState(undefined as number | undefined);
	const [, imageCacheUpdated] = React.useState<string>('');

	let skill_aggregates: { [sk: string]: { skill: string; core: number; range_min: number; range_max: number; } } = {};
	Object.keys(CONFIG.SKILLS).forEach(sk => skill_aggregates[sk] = { skill : sk, core : 0, range_max: 0, range_min: 0});

	if (props.state === 'inprogress' || props.state === 'done' || props.state === 'open') {
		let crewSpans: any[] = [];
		props.crewSelection.forEach((entry) => {
			if (entry.choice) {
				let isShuttle = false;
				STTApi.playerData.character.shuttle_adventures.forEach((shuttle) => {
					if (shuttle.shuttles[0].id === entry.choice.active_id) {
						isShuttle = true;
					}
				});

				let trait = STTApi.playerData.character.voyage_descriptions[0].crew_slots[entry.slotId].trait;
				let traitDisp = STTApi.getTraitName(trait);
				let traitMatch = entry.choice.rawTraits.find(t => t === trait);

				let status = entry.choice.frozen > 0 ? 'Frozen' : entry.choice.active_id ? isShuttle ? 'On Shuttle' : 'On Voyage' : 'Available';
				let crewCard =
					<Card key={entry.choice.crew_id || entry.choice.id} color={status === 'Frozen' ? 'red' : status === 'Available' ? 'green' : 'yellow'}>
						<Card.Content>
							<Image floated='right' size='mini' src={STTApi.imgUrl(entry.choice.portrait, imageCacheUpdated)} />
							<Card.Header>{entry.choice.name}</Card.Header>
							<Card.Meta>
								{STTApi.playerData.character.voyage_descriptions[0].crew_slots[entry.slotId].name}<br/>
								{traitMatch ? <b>{traitDisp} (Match)</b> : traitDisp }
							</Card.Meta>
							<Card.Description>
								<CrewSkills crew={entry.choice} useIcon={false} asVoyScore={true} addVoyTotal={true} starBreakSpace={true} voyBreakSpace={true} />
							</Card.Description>
						</Card.Content>
						<Card.Content extra>
							Status: {status} <Button onClick={() => setSelectSlotId(selectSlotId !== undefined ? undefined : entry.slotId)} style={{float:'right'}} content='Select'/>
						</Card.Content>
					</Card>;

				crewSpans[entry.slotId] = crewCard;

				Object.keys(entry.choice.skills).forEach(sk => {
					let sd = entry.choice.skills[sk];
					skill_aggregates[sk].core += sd.core;
					skill_aggregates[sk].range_min += sd.min;
					skill_aggregates[sk].range_max += sd.max;
				});
			} else {
				console.error(entry);
			}
		});

		const numSlots = STTApi.playerData.character.voyage_descriptions[0].crew_slots.length;
		for (let s=0; s<numSlots; ++s) {
			if (!crewSpans[s]) {
				let trait = STTApi.playerData.character.voyage_descriptions[0].crew_slots[s].trait;
				let traitDisp = STTApi.getTraitName(trait);
				crewSpans[s] = <Card key={s} color={'red'}>
					<Card.Content>
						<Card.Header>{}</Card.Header>
						<Card.Meta>
							{STTApi.playerData.character.voyage_descriptions[0].crew_slots[s].name}<br />
							{traitDisp}
						</Card.Meta>
						<Card.Description>
						</Card.Description>
					</Card.Content>
					<Card.Content extra>
						Status: Open <Button onClick={() => setSelectSlotId(selectSlotId !== undefined ? undefined : s) } style={{ float: 'right' }} content='Select' />
					</Card.Content>
				</Card>
			}
		}

		const primarySecondaryOutput = (sk: Skill) => {
			let isPri = sk.skill === STTApi.playerData.character.voyage_descriptions[0].skills.primary_skill;
			let isSec = sk.skill === STTApi.playerData.character.voyage_descriptions[0].skills.secondary_skill;
			return (
				<span>{isPri ? 'Primary' : isSec ? 'Secondary' : ''}</span>
			)
		};
		const failOutput = (sk: Skill) => {
			const sv = sk.core + (sk.range_min + sk.range_max) / 2;
			const failSeconds = (sv * 0.045 + 34) * 60;
			return (
				<div>First hazard failure<br/>expected @ {formatTimeSeconds(failSeconds)}</div>
			)
		};
		return <div className='voyage-crew-select'>
				{props.state === 'inprogress' && <div className='ui medium centered text active inline loader'>Still calculating...</div>}
				{selectSlotId !== undefined &&
					<Dropdown
						fluid
						selection
						options={buildOptions(selectSlotId)}
						onChange={(e, { value }) => setChoice(selectSlotId, value as number)}
						// value={}
					/>
				}
				<Card.Group>{crewSpans}</Card.Group>
				{
					props.crewSelection.length > 0 &&
					<VoyageSkillsReadout
						skill_aggregates={skill_aggregates}
						success_readout={primarySecondaryOutput}
						failure_readout={failOutput}
					/>
				}
			</div>;
	} else {
		return <span />;
	}

	function buildOptions(slotId: number) : DropdownItemProps[] {
		const slotTrait = STTApi.playerData.character.voyage_descriptions[0].crew_slots[slotId].trait;
		const slotSkill = STTApi.playerData.character.voyage_descriptions[0].crew_slots[slotId].skill;
		const available = props.crewAvailable.filter(c => c.skills[slotSkill].voy > 0);
		return available.sort((a, b) => {
			const av = Object.keys(CONFIG.SKILLS).map(k => a.skills[k].voy).reduce((acc, c) => acc + c, 0);
			const bv = Object.keys(CONFIG.SKILLS).map(k => b.skills[k].voy).reduce((acc, c) => acc + c, 0);
			return bv - av;
		}).map(c => ({
			content: <span>{c.name} <CrewSkills crew={c} useIcon={true} asVoyScore={true} addVoyTotal={true} /> {
				c.rawTraits.find(t => t === slotTrait) ? <b>{slotTrait}</b> : ''}</span>,
			image: STTApi.imgUrl(c.portrait, imageCacheUpdated),
			value: c.crew_id
		} as DropdownItemProps));
	}

	function setChoice(slotId: number, crewId: number) {
		let newSelection = props.crewSelection.filter(cc => cc.slotId !== slotId && cc.choice.crew_id !== crewId);
		newSelection.push({
			slotId,
			choice: props.crewAvailable.find(c => c.crew_id === crewId)!
		});
		props.crewUpdated(newSelection);
		setSelectSlotId(undefined);
	}
}
