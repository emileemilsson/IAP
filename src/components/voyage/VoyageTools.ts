import Moment from 'moment';
import VoyWorker from "worker-loader!./VoyageWorker";
import STTApi, { CONFIG } from '../../api/index';
import { mergeDeep } from '../../api/ObjectMerge';
import { CrewData, VoyageUpdateDTO, VoyageNarrativeDTO, ShipDTO, VoyageExportData, VoyageDescriptionDTO } from '../../api/DTO';
import { CalcChoice, CalcExportData } from './voyageCalc';
import { VoyageWorkerResult, VoyageDurationWorkerResult, VoyageDurationWorkerMessage, VoyageWorkerMessage } from './VoyageWorker';

/**
 * Worst-case voyage AM decay rate (if all hazards fail)
 * One hazard every 80 seconds, skip every sixth (480s is loot);
 * 30 AM loss per hazard, +3 AM loss for three ticks at 20, 40, 60
 * = -33AM/80s
 * = -.4125 AM/s
 * Non-30 loss every 480s
 * = 30AM/480s = .0625 AM/s
 * Add 1 loss every 480s
 * = 1/480 = .002083
 * = -.4125 + .0625 + .002083 = -.347916 (*60 s/m) = 20.875 AM/m
 */
export const VOYAGE_AM_DECAY_PER_MINUTE = 20.875;

export const SECONDS_PER_TICK: number = 20;
export const TICKS_PER_DILEMMA: number = 360; // sec/min(60) * tick/sec(1/20) * min/hr(60) * hr/dilemma(2) = 360

export async function loadVoyage(voyageId: number, newOnly: boolean = true): Promise<VoyageNarrativeDTO[]> {
	let data = await STTApi.executePostRequest('voyage/refresh', { voyage_status_id: voyageId, new_only: newOnly });
	if (data) {
		let voyageNarrative: VoyageNarrativeDTO[] = [];

		data.forEach((action: any) => {
			if (action.character && action.character.voyage) {
				let voy: VoyageUpdateDTO = action.character.voyage[0];

				// Clear out the dilemma resolutions before load to avoid duplicates
				if (STTApi.playerData.character.voyage[0] && STTApi.playerData.character.voyage[0].dilemma) {
					STTApi.playerData.character.voyage[0].dilemma.resolutions = [];
				}
				STTApi.playerData.character.voyage[0] = mergeDeep(STTApi.playerData.character.voyage[0], voy);
			} else if (action.voyage_narrative) {
				voyageNarrative = action.voyage_narrative;
			}
		});

		STTApi.lastSyncVoyage = Moment();
		return voyageNarrative;
	} else {
		throw new Error('Invalid data for voyage!');
	}
}

export async function recallVoyage(voyageId: number): Promise<void> {
	let data = await STTApi.executePostRequest('voyage/recall', { voyage_status_id: voyageId });
	if (!data) {
		throw new Error('Invalid data for voyage!');
	}
}

export async function completeVoyage(voyageId: number): Promise<void> {
	let data = await STTApi.executePostRequest('voyage/complete', { voyage_status_id: voyageId });
	if (!data) {
		throw new Error('Invalid data for voyage completion!');
	}

	data = await STTApi.executePostRequest('voyage/claim', { voyage_status_id: voyageId });
	if (!data) {
		throw new Error('Invalid data for voyage claim!');
	}
}

export async function reviveVoyage(voyageId: number): Promise<void> {
	let data = await STTApi.executePostRequest('voyage/revive', { voyage_status_id: voyageId });
	if (!data) {
		throw new Error('Invalid data for voyage revive!');
	}
}

export async function resolveDilemma(voyageId: number, dilemmaId: number, index: number): Promise<void> {
	await STTApi.executePostRequestWithUpdates('voyage/resolve_dilemma', {
		voyage_status_id: voyageId,
		dilemma_id: dilemmaId,
		resolution_index: index
	});
}

export async function startVoyage(
	voyageSymbol: string,
	shipId: number,
	shipName: string | undefined,
	selectedCrewIds: Array<number>
): Promise<void> {
	// Start by getting up-to-date crew status
	await STTApi.resyncInventory();

	let availableCrew = new Set<number>();
	STTApi.playerData.character.crew.forEach((crew) => {
		if (!crew.active_id) {
			availableCrew.add(crew.id);
		}
	});

	// Validate all selected crew is available and not already active
	selectedCrewIds.forEach(crewid => {
		if (!availableCrew.has(crewid)) {
			let crew = STTApi.roster.find((crew: CrewData) => crew.crew_id === crewid);
			throw new Error(
				`Cannot send '${
					crew ? crew.name : crewid
				}' out on a voyage because they are already active! Please DO NOT use this tool at the same time as the game on any platform. Close all game clients then close and restart the tool to try again!`
			);
		}
	});

	let params: any = {
		voyage_symbol: voyageSymbol,
		ship_id: shipId,
		crew_ids_string: selectedCrewIds.join(',')
	};

	if (shipName !== undefined) {
		params.ship_name = shipName;
	}

	await STTApi.executePostRequestWithUpdates('voyage/start', params);
}

export function bestVoyageShip(): {ship: ShipDTO, score: number }[] {
	let voyage = STTApi.playerData.character.voyage_descriptions[0];

	let consideredShips: { ship: ShipDTO, score: number }[] = [];
	STTApi.ships.forEach((ship) => {
		if (ship.id > 0) {
			let entry = {
				ship: ship,
				score: ship.antimatter
			};

			if (ship.traits.find((trait) => trait == voyage.ship_trait)) {
				entry.score += 150; // TODO: where is this constant coming from (Config)?
			}

			consideredShips.push(entry);
		}
	});

	consideredShips = consideredShips.sort((a, b) => b.score - a.score);

	return consideredShips;
}

// Determines actual voyage duration from the narrative
export function voyDuration(narrative: VoyageNarrativeDTO[]) : number {
	if (!narrative || narrative.length == 0)
		return 0;
	let maxLogIndex: number = narrative[narrative.length - 1].index;
	let dilemmaCount = Math.floor(maxLogIndex / TICKS_PER_DILEMMA);
	let lastDilemmaTick = dilemmaCount * TICKS_PER_DILEMMA;

	let tailTickCount = maxLogIndex - lastDilemmaTick;

	//console.log('max ' + maxLogIndex + " dil count" + dilemmaCount + ' tail ' + tailTickCount);

	if (tailTickCount > 0) {
		let firstAfter: VoyageNarrativeDTO | undefined = narrative.find(entry => entry.index === (lastDilemmaTick + 1));
		if (firstAfter) {
			let tailTime = narrative[narrative.length - 1].event_time - firstAfter.event_time;
			let tailTicks = tailTime / SECONDS_PER_TICK + 1; // add one back because the subtraction was to the "first after"

			let totalTime = (dilemmaCount * TICKS_PER_DILEMMA + tailTicks) * SECONDS_PER_TICK;
			//console.log('tailticks: ' + tailTicks + ' total time: ' + formatTimeSeconds(totalTime, true));
			return totalTime;
		}
	}

	return dilemmaCount * TICKS_PER_DILEMMA * SECONDS_PER_TICK;
}

export function toSkillValues(sels: CalcChoice[], vdesc: VoyageDescriptionDTO) : {[sk:string]:number} {
	let svs : {[sk:string]:number} = {};
	sels.forEach(ch => Object.keys(ch.choice.skills).forEach(sk => {
		if (!svs[sk]) { svs[sk] = 0; }
		svs[sk] += ch.choice.skills[sk].voy;
	}));
	return svs;
}

// Estimates voyage duration based on skill value and first failure time
export function estimateVoyageDuration(pri: string, sec: string, svs: {[sk:string]:number}, currVoyTimeMinutes: number, amStart: number, log: boolean, done: (mins:number) => void) {
	const worker = new VoyWorker() as Worker;

	worker.onmessage = (event: MessageEvent) => {
		const r = event.data as VoyageDurationWorkerResult
		//console.log(event);
		done(r.minutesLeft);
	};

	worker.postMessage({op:'estimateDuration', options:{pri, sec, svs, currVoyTimeMinutes, amStart, log} as VoyageDurationWorkerMessage });
}

interface VoyCalcOptions {
	vd: VoyageDescriptionDTO;
	roster: CrewData[];
	shipAM: number;
}

export function calculateVoyage(options: VoyCalcOptions,
	progressCallback: (choices: CalcChoice[], hoursLeft: number) => void,
	doneCallback: (choices: CalcChoice[], hoursLeft: number) => void) : void
{
	const worker = new VoyWorker() as Worker;

	worker.onmessage = (event: MessageEvent) => {
		const r = event.data as VoyageWorkerResult
		//console.log(event);
		doneCallback(r.choices, r.hoursLeft);
	};

	progressCallback([], 0);

	const opts = options as VoyageWorkerMessage;
	worker.postMessage({op:'calculateVoyage', options: opts });
}

export function calculateVoyageCrewRank(
	options: VoyCalcOptions,
	done: (rankResult: string, estimateResult: string) => void) : void {

	let result : { p: string, s: string, est: number, c: CalcChoice[] }[] = [];
	let tasks : VoyCalcOptions[] = [];

	Object.keys(CONFIG.SKILLS).forEach(pri => {
		Object.keys(CONFIG.SKILLS).forEach(sec => {
			if (pri === sec) {
				return;
			}

			let opts : VoyCalcOptions = {
				...options,
				vd: {
					...options.vd,
					skills: { primary_skill: pri, secondary_skill: sec },
					crew_slots: options.vd.crew_slots.map(cs => {return {...cs, trait: '_no_trait_'};})
				}
			};
			tasks.push(opts);
		})
	});

	tasks.forEach(opts =>
		calculateVoyage(
			opts,
			(entries: CalcChoice[], score: number) => {
			},
			(entries: CalcChoice[], score: number) => {
				//console.log(CONFIG.SKILLS_SHORT[opts.vd.skills.primary_skill] + '-' + CONFIG.SKILLS_SHORT[opts.vd.skills.secondary_skill] + ' ' + score);
				result.push({ p: opts.vd.skills.primary_skill, s: opts.vd.skills.secondary_skill, est: score, c: entries});

				if (result.length === tasks.length) {
					// rankResult format is: "Score,Alt 1,Alt 2,Alt 3,Alt 4,Alt 5,Status,Crew,Voyages (Pri),Voyages(alt)"
					// estimateResult format is "Primary,Secondary,Estimate,Crew\nDIP, CMD, 8.2, crew1 | crew2 | crew3 | crew4 | crew5 | ... crew12\nCMD, DIP, 8.2, crew1 | ... "
					//TODO: properly collect results and provide to the handler
					done(toCrewResult(result), toEstimateResult(result));
				}
			}
		)
	);
}

function cleanCrewName(name: string) : string {
	if (!name) { return 'unknown'; }
	return name.replace(/[^\x00-\x7F]/g, "").replace(/"/g, "'")
}

function toCrewResult(result: { p: string, s: string, est: number, c: CalcChoice[] }[]) : string {
	let ranks : { [cid: string] : { cd: CrewData, voys: string[] }} = {};

	result.forEach(r => {
		let v = CONFIG.SKILLS_SHORT[r.p] + '/' + CONFIG.SKILLS_SHORT[r.s];
		r.c.forEach(c => {
			let cr = ranks[c.choice.crew_id] ?? { cd: c.choice, voys: []};
			ranks[c.choice.crew_id] = cr;
			cr.voys.push(v);
			//console.log(c.choice.crew_id + ' ' + c.choice.name + ' ');
			//console.log(v);
		});
	});

	//result.forEach(r => console.log(r.c));

	let crew = Object.keys(ranks).map(k => ranks[k]).sort((a,b) => b.voys.length - a.voys.length);

	let rv : string[] = ['Score,Alt 1,Alt 2,Alt 3,Alt 4,Alt 5,Status,Crew,Voyages (Pri),Voyages(alt)'];
	crew.map(c => c.voys.length + ',,,,,, ,"'+cleanCrewName(c.cd.name)+'",' + c.voys.join(' ') + ',').forEach(r => rv.push(r));

	return rv.join('\n');
}

function toEstimateResult(result: { p: string, s: string, est: number, c: CalcChoice[] }[]) : string {
	let r = [...result];
	let rv: string[] = ['Primary,Secondary,Estimate,Crew'];
	r.sort((a,b) => b.est - a.est);

	r.map(e => CONFIG.SKILLS_SHORT[e.p]+',' + CONFIG.SKILLS_SHORT[e.s] + ',' + e.est + ',' + e.c.map(c => c.choice.name).join(' | ')).forEach(e => rv.push(e));
	return rv.join('\n');
}
