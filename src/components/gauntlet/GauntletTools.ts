import Moment from 'moment';
import STTApi from '../../api/index';
import CONFIG from '../../api/CONFIG';
import { GauntletDTO, GauntletCrewDTO, CrewData, GauntletContestDTO, GauntletContestLootDTO } from '../../api/DTO21';

export interface GauntletData {
	gauntlet: GauntletDTO;
	lastResult?: GauntletContestDTO;
	rewards?: { loot: GauntletContestLootDTO[] };
}

export async function loadGauntlet(): Promise<GauntletDTO> {
	let data = await STTApi.executeGetRequest('gauntlet/status', { });

	// Clear out old data
	STTApi.playerData.character.gauntlets = [];

	await STTApi.applyUpdates(data);
	STTApi.lastSyncGauntlet = Moment();

	return STTApi.playerData.character.gauntlets[0];
}

export async function payToGetNewOpponents(): Promise<{message?:string; gauntlet?: GauntletDTO; }> {
	let data = await STTApi.executePostRequest('gauntlet/refresh_opp_pool_and_revive_crew', { pay: true });

	// Clear out old data
	STTApi.playerData.character.gauntlets = [];

	let newData = await STTApi.applyUpdates(data);

	if (newData.length > 0 && newData[0].message) {
		return { message: newData[0].message };
	} else {
		return { gauntlet: STTApi.playerData.character.gauntlets[0] };
	}
}

// Save is false if the crew is not disabled yet; true if the crew is disabled already
export async function payToReviveCrew(crew_id: number, save: boolean): Promise<GauntletDTO> {
	let data = await STTApi.executePostRequest('gauntlet/revive_after_crew_contest_loss', {
		save: save,
		crew_id: crew_id
	});

	// Clear out old data
	STTApi.playerData.character.gauntlets = [];

	await STTApi.applyUpdates(data);

	return STTApi.playerData.character.gauntlets[0];
}

export async function playContest(gauntlet: GauntletDTO, match: Match, consecutive_wins: number): Promise<GauntletData> {
	let postData: any = {
		gauntlet_id: gauntlet.gauntlet_id,
		crew_id: match.crewOdd.crew_id,
		opponent_id: match.opponent.player_id,
		op_crew_id: match.opponent.crew_id,
		boost: false
	};

	if (STTApi.inWebMode) {
		postData.match = match;
		postData.consecutive_wins = consecutive_wins;
	}

	let data = await STTApi.executePostRequest('gauntlet/execute_crew_contest', postData);

	// Clear out old data
	STTApi.playerData.character.gauntlets = [];

	let newData = await STTApi.applyUpdates(data);

	let contest : GauntletContestDTO | undefined = undefined;
	let rewards : GauntletContestLootDTO | undefined = undefined;
	newData.forEach((item: any) => {
		if (item.contest) {
			contest = item.contest;
		} else if (item.rewards) {
			rewards = item.rewards;
		}
	});

	if (contest) {
		return { gauntlet: STTApi.playerData.character.gauntlets[0], lastResult: contest, rewards: rewards };
	} else {
		throw new Error('Invalid data for gauntlet!');
	}
}

export async function enterGauntlet(gauntletId: number, crewIds: Array<number>): Promise<GauntletDTO> {
	let data = await STTApi.executePostRequest('gauntlet/enter_crew_contest_gauntlet', {
		gauntlet_id: gauntletId,
		crew1_id: crewIds[0],
		crew2_id: crewIds[1],
		crew3_id: crewIds[2],
		crew4_id: crewIds[3],
		crew5_id: crewIds[4]
	});

	// Clear out old data
	STTApi.playerData.character.gauntlets = [];

	await STTApi.applyUpdates(data);

	return STTApi.playerData.character.gauntlets[0];
}

export interface CrewOdd extends GauntletCrewDTO {
	used: number;
	max: number[];
	min: number[];
}

export interface OpponentOdd {
	name: string;
	level: number;
	value: number;
	rank: number;
	player_id: number;
	crew_id: number;
	archetype_symbol: string;
	crit_chance: number;
	max: number[];
	min: number[];
}

export interface Match {
	crewOdd: CrewOdd;
	opponent: OpponentOdd;
	chance: number;
}

export interface GauntletRoundOdds {
	rank: number;
	consecutive_wins: number;
	crewOdds: CrewOdd[];
	opponents: OpponentOdd[];
	matches: Match[];
}

export function gauntletRoundOdds(currentGauntlet: GauntletDTO, simulatedRounds: number): GauntletRoundOdds {
	let result: GauntletRoundOdds = {
		rank: currentGauntlet.rank,
		consecutive_wins: currentGauntlet.consecutive_wins,
		crewOdds: [],
		opponents: [],
		matches: []
	};

	currentGauntlet.contest_data.selected_crew.forEach((crew: GauntletCrewDTO) => {
		if (!crew.disabled) {
			let crewOdd: CrewOdd = {
				...crew,
				used: crew.debuff / 4,
				max: [0, 0],
				min: [0, 0],
			};

			crew.skills.forEach((skillStats) => {
				if (skillStats.skill == currentGauntlet.contest_data.primary_skill) {
					crewOdd.max[0] = skillStats.max;
					crewOdd.min[0] = skillStats.min;
				} else if (skillStats.skill == currentGauntlet.contest_data.secondary_skill) {
					crewOdd.max[1] = skillStats.max;
					crewOdd.min[1] = skillStats.min;
				}
			});

			result.crewOdds.push(crewOdd);
		}
	});

	currentGauntlet.opponents.forEach((opponent) => {
		let opponentOdd: OpponentOdd = {
			name: opponent.name,
			level: opponent.level,
			value: opponent.value,
			rank: opponent.rank,
			player_id: opponent.player_id,
			crew_id: opponent.crew_contest_data.crew[0].crew_id,
			archetype_symbol: opponent.crew_contest_data.crew[0].archetype_symbol,
			crit_chance: opponent.crew_contest_data.crew[0].crit_chance,
			max: [0, 0],
			min: [0, 0]
		};

		opponent.crew_contest_data.crew[0].skills.forEach((skillStats) => {
			if (skillStats.skill == currentGauntlet.contest_data.primary_skill) {
				opponentOdd.max[0] = skillStats.max;
				opponentOdd.min[0] = skillStats.min;
			} else if (skillStats.skill == currentGauntlet.contest_data.secondary_skill) {
				opponentOdd.max[1] = skillStats.max;
				opponentOdd.min[1] = skillStats.min;
			}
		});

		result.opponents.push(opponentOdd);
	});

	const roll = (data: CrewOdd | OpponentOdd, skillIndex: number): number => {
		let max = Math.random() < 0.5 ? 0 : 1;
		let min = Math.random() < 0.5 ? 0 : 1;
		if (data.min[skillIndex] > 0) {
			max = data.max[skillIndex];
			min = data.min[skillIndex];
		}

		return Math.floor(Math.random() * (max - min) + min) * (Math.random() < data.crit_chance / 100 ? 2 : 1);
	};

	result.matches = [];

	result.crewOdds.forEach((crewOdd: CrewOdd) => {
		result.opponents.forEach((opponent: OpponentOdd) => {
			if ((crewOdd.max[0] + crewOdd.max[1]) * 2 < opponent.min[0] + opponent.min[1]) {
				// If there is 0 chance of winning, bail early and don't waste time
				result.matches.push({
					crewOdd: crewOdd,
					opponent: opponent,
					chance: 0
				});
			} else if ((opponent.max[0] + opponent.max[1]) * 2 < crewOdd.min[0] + crewOdd.min[1]) {
				// If there is 100 chance of winning, bail early and don't waste time
				result.matches.push({
					crewOdd: crewOdd,
					opponent: opponent,
					chance: 100
				});
			} else {
				// TODO: this is silly; perhaps someone more statisitically-inclined can chime in with a proper probabilistic formula
				let wins = 0;
				for (let i = 0; i < simulatedRounds; i++) {
					let totalCrew = roll(crewOdd, 0);
					totalCrew += roll(crewOdd, 0);
					totalCrew += roll(crewOdd, 0);
					totalCrew += roll(crewOdd, 1);
					totalCrew += roll(crewOdd, 1);
					totalCrew += roll(crewOdd, 1);

					let totalOpponent = roll(opponent, 0);
					totalOpponent += roll(opponent, 0);
					totalOpponent += roll(opponent, 0);
					totalOpponent += roll(opponent, 1);
					totalOpponent += roll(opponent, 1);
					totalOpponent += roll(opponent, 1);

					if (totalCrew > totalOpponent) wins++;
				}

				result.matches.push({
					crewOdd: crewOdd,
					opponent: opponent,
					chance: Math.floor((wins / simulatedRounds) * 100)
				});
			}
		});
	});

	result.matches.sort((a, b) => b.chance - a.chance);

	return result;
}

interface SortedCrew {
	id: number;
	name: string;
	score: number;
}

interface GauntletCrew {
	skills: { [key: string]: number;};
	id: number;
	name: string;
	crit: number;
}

export interface GauntletCrewSelection {
	best: { [key: string]: string; };
	recommendations: Array<number>;
}

export function gauntletCrewSelection(
	currentGauntlet: GauntletDTO,
	roster: CrewData[],
	featuredSkillBonus: number,
	critBonusDivider: number,
	preSortCount: number,
	includeFrozen: boolean
): GauntletCrewSelection {
	let gauntletCrew: GauntletCrew[] = [];

	roster.forEach((crew) => {
		if (crew.frozen > 0 && !includeFrozen) {
			return;
		}

		let newCrew: GauntletCrew = {
			id: crew.crew_id || crew.id,
			name: crew.name,
			crit: 5,
			skills: {}
		};

		for (let skill in CONFIG.SKILLS) {
			newCrew.skills[skill] = crew.skills[skill].min + crew.skills[skill].max;
		}

		newCrew.skills[currentGauntlet.contest_data.featured_skill] =
			newCrew.skills[currentGauntlet.contest_data.featured_skill] * featuredSkillBonus;

		currentGauntlet.contest_data.traits.forEach((trait) => {
			if (crew.rawTraits.includes(trait)) newCrew.crit += currentGauntlet.contest_data.crit_chance_per_trait;
		});

		for (let skill in CONFIG.SKILLS) {
			newCrew.skills[skill] = (newCrew.skills[skill] * (100 + newCrew.crit / critBonusDivider)) / 100;
		}

		gauntletCrew.push(newCrew);
	});

	let sortedCrew: SortedCrew[] = [];

	function getScore(gauntletCrewItem: GauntletCrew, maxSkill: string): number {
		let score = gauntletCrewItem.skills[maxSkill]; // double account for preferred skill

		for (let skill in CONFIG.SKILLS) {
			score += gauntletCrewItem.skills[skill];
		}

		return score;
	}

	let result: GauntletCrewSelection = { best: {}, recommendations: [] };

	for (let skill in CONFIG.SKILLS) {
		gauntletCrew.sort((a, b) => {
			return b.skills[skill] - a.skills[skill];
		});
		result.best[skill] = gauntletCrew[0].name;

		// Get the first few in the final score sheet
		for (let i = 0; i < preSortCount; i++) {
			sortedCrew.push({ id: gauntletCrew[i].id, name: gauntletCrew[i].name, score: getScore(gauntletCrew[i], skill) });
		}
	}

	sortedCrew.sort((a, b) => b.score - a.score);

	// Remove duplicates
	let seen = new Set();
	sortedCrew = sortedCrew.filter((item) => {
		if (seen.has(item.id)) {
			return false;
		} else {
			seen.add(item.id);
			return true;
		}
	});

	// Get the first 5
	sortedCrew = sortedCrew.slice(0, 5);

	result.recommendations = sortedCrew.map(crew => crew.id);

	return result;
}
