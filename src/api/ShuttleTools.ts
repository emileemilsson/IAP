import STTApi, { CONFIG } from "./index";
import { CrewData, BorrowedCrewDTO, PlayerShuttleDTO, SHUTTLE_STATE_OPENED, ItemDTO, ItemData } from "./DTO";

export interface CrewItem {
	crew: CrewData | BorrowedCrewDTO;
	skills: { [sk: string]: number };
	total: number;

	// These three are needed for the item to appear in a combo
	text?: string;
	content?: any;
	value?: number;
	image?: string;
}

export interface CrewChoice {
	slotIndex: number;
	item?: CrewItem;
	userSelect?: boolean;
}

export interface ShuttleSelection {
	calc: ShuttleCalc;
	chosen: CrewChoice[];
	bonus?: {
		item: ItemData;
		userSelect: boolean;
	};
}

export interface ShuttleCalc {
	challenge_rating: number;
	shuttle: PlayerShuttleDTO;
	chance: (crew: (CrewItem | undefined)[], bonus: ItemData | undefined) => number;
	slots: ShuttleCalcSlot[];
}

export interface ShuttleCalcSlot {
	skillText: string;
	slotIndex: number;
	crewValue: (crew: CrewItem, bonus: ItemDTO | undefined) => number;
	bestCrew: CrewItem[];
}

export async function shuttleComplete(id: number): Promise<void> {
	await STTApi.executePostRequestWithUpdates("shuttle/complete", { id });
}

// Use an item with type=6 (shuttle token) and quantity>0
export async function shuttleNewMission(token: ItemDTO): Promise<void> {
	await STTApi.executePostRequestWithUpdates("shuttle/redeem_token", { id: token.id });
}

// comsumable is of item type=4; 3* adds 6%, 4* adds 12%, 5* adds 19%
export async function shuttleStart(shuttle: PlayerShuttleDTO,
	crew: (CrewData | BorrowedCrewDTO)[],
	consumable_id: number | undefined,
	displayed_percent_success: number,
	useToken: boolean
): Promise<void> {
	let dto : any = {
		id: shuttle.id,
		crew: crew.map(c => cid(c)).join(','),
		consumable: consumable_id ? consumable_id : 0,
		displayed_percent_success: `${displayed_percent_success}%`,
		is_rental: useToken ? 1 : 0,
	};

	const borrow = crew.findIndex(c => ((c as CrewData).crew_id) == undefined);
	if (borrow != -1) {
		dto.borrow_index = borrow;
	}

	await STTApi.executePostRequestWithUpdates("shuttle/start", dto);
}

//TODO: need to determine how many active tokens are in use to use this API
export async function shuttleValidateToken(tokensInUse: number): Promise<boolean> {
	return await STTApi.executePostRequest("shuttle/validate_allowed_shuttle", { current_rentals: tokensInUse });
}

export function getBonusedRoster(crew_bonuses: { [crew_symbol: string]: number; }, allowBorrow: boolean, exclude: number[]): CrewItem[] {
	let rv: CrewItem[] = [];
	STTApi.roster.forEach(crew => {
		if (crew.buyback || crew.frozen > 0) {
			return;
		}

		if (exclude.includes(crew.crew_id)) {
			return;
		}

		const foundBonus = crew_bonuses[crew.symbol] ?? 1;

		let skills: { [sk: string]: number } = {};
		for (let sk in CONFIG.SKILLS) {
			skills[sk] = crew.skills[sk].core * foundBonus;
		}

		rv.push({
			crew: crew,
			skills,
			total: 0
		});
	});

	// These don't show up until you have already used them
	let brws = STTApi.playerData.character.crew_borrows ?? [];
	if (brws.length === 0) {
		// These are synchronized, but don't have "active*" fields
		brws = STTApi.borrowableCrew ?? [];
	}
	if (brws && allowBorrow) {
		brws.forEach(crew => {
			const foundBonus = crew_bonuses[crew.symbol] ?? 1;

			let skills: { [sk: string]: number } = {};
			for (let sk in CONFIG.SKILLS) {
				// borrowed crew does not have all skills filled like CrewData does
				if (!crew.skills[sk]) {
					skills[sk] = 0;
				}
				else {
					skills[sk] = crew.skills[sk].core * foundBonus;
				}
			}

			rv.push({
				crew: crew,
				skills,
				total: 0
			});
		});
	}
	return rv;
}

export function cid(c: CrewData | BorrowedCrewDTO): number {
	if ((c as CrewData).crew_id) {
		return (c as CrewData).crew_id;
	}
	return c.id;
}

export function computeChance(challenge_rating: number, numberofSlots: number, skillSum: number): number {
	return Math.floor(
		100 /
		(1 +
			Math.exp(
				STTApi.serverConfig!.config.shuttle_adventures.sigmoid_steepness *
				(STTApi.serverConfig!.config.shuttle_adventures.sigmoid_midpoint - skillSum / (challenge_rating * numberofSlots))
			))
	);
}

export function skillBonus(item: ItemDTO | undefined, sk: string) : number {
	if (item?.bonuses) {
		//FIXME: are there ever more than one here?
		let k = Object.keys(item.bonuses).shift();
		if (k) {
			const v = item.bonuses[k];
			let sc = STTApi.serverConfig?.config.stats_config.stat_desc_by_id[k];
			if (sc && sc.skill === sk) {
				return v;
			}
		}
	}
	return 0;
}


const LOG_CALCULATE = false;

// Compute "best" crew for the available shuttles
// Uses a basic simulated annealing metaheuristic approach:
//   select first unused for each slot (decent good selection)
//   permutate slightly
//   keep better result; keep worse result if it passes a threshhold (to jump to another local maximum)
export const computeCrew = async (
	bonusedRoster: CrewItem[], shuttleCalcs: ShuttleCalc[], userChoices: ShuttleSelection[],
	options?: {
		useBonuses?: boolean;
		useBonuses45?: boolean;
	}
): Promise<ShuttleSelection[]> => {
	// Initial configuration
	let availableBonuses : ItemData[] = [];
	if (options?.useBonuses) {
		availableBonuses = STTApi.items.filter(item => item.type === 4);
		if (!options.useBonuses45) {
			availableBonuses = availableBonuses.filter(item => item.rarity < 4);
		}
	}
	let current = selectRandom(undefined);
	let next: ShuttleSelection[] = [];
	let iteration = 0;
	let alpha = 0.999;
	let temperature = 400.0;
	let epsilon = 0.001;
	let currentNrg = nrgToMax(current);
	// Not necessary, but keeps from blowing up indefinitely if the math goes wrong
	const maxIter = 100000;

	let best = current;
	let bestNrg = currentNrg;

	//console.log("Initial energy: " + currentNrg);

	//while the temperature did not reach epsilon
	while (temperature > epsilon && iteration < maxIter) {
		iteration++;
		//print every 400 iterations
		// if (iteration % 400 == 0) {
		// 	console.log(currentNrg);
		// }

		next = selectRandom(current);
		let nextNrg = nrgToMax(next);
		if (nextNrg == currentNrg) {
			continue;
		}
		if (nextNrg > currentNrg) {
			if (LOG_CALCULATE) {
				console.log("Better energy: " + nextNrg + " > " + currentNrg);
			}
			current = next;
			currentNrg = nextNrg;

			best = current;
			bestNrg = currentNrg;
		}
		else {
			const proba = Math.random();
			//if the new nrg is worse accept
			//it but with a probability level
			//if the probability is less than
			//E to the power -delta/temperature.
			//otherwise the old value is kept
			const delta = nextNrg - currentNrg;
			const threshold = Math.exp(delta / temperature);
			if (proba < threshold) {
				if (LOG_CALCULATE) {
					console.log("Override better energy: " + nextNrg + " < " + currentNrg + " @ " + proba + " " + threshold);
				}
				current = next;
				currentNrg = nextNrg;
			}
		}
		//cooling process on every iteration
		temperature *= alpha;
	}

	if (LOG_CALCULATE) {
		console.log("Best energy: " + bestNrg + " iters:" + iteration);
	}
	return best;

	// Energy function for annealing.
	// Sums the percent chance for shuttles to succeed, then subtracts a factor of the std dev to even them
	function nrgToMax(sels: ShuttleSelection[]): number {
		let chances = sels.map(sel => {
			const chosenItems = sel.chosen.map(ch => ch.item);
			return sel.calc.chance(chosenItems, sel.bonus?.item);
		});

		const n = chances.length;
		const sum = chances.reduce((a, b) => a + b);
		const mean = sum / n;
		const stddev = Math.sqrt(chances.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);

		// even the chances by subtracting a factor of the stddev
		return sum - (stddev / 3);
	}

	function selectRandom(selsCurrent?: ShuttleSelection[]): ShuttleSelection[] {
		let sels: ShuttleSelection[] = [];
		let usedCrew: Set<number> = new Set<number>();

		// First, mark active (on shuttles or voyages) and user-selected crew as "used"
		bonusedRoster.filter(c => c.crew.active_id).forEach(ac => usedCrew.add(cid(ac.crew)));
		shuttleCalcs.forEach(calc => {
			let userChosen = userChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id)?.chosen ?? [];
			userChosen.forEach(uc => {
				const c = uc.item;
				if (c) {
					let crid = cid(c.crew)
					if (crid) {
						usedCrew.add(crid);
					}
				}
			});
		});

		function shuffle(array: any[]) {
			for (let i = array.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[array[i], array[j]] = [array[j], array[i]];
			}
		}
		let calcs = shuttleCalcs.slice();
		shuffle(calcs);

		calcs.forEach((calc, ci) => {
			let chosen: CrewChoice[] = [];
			const userSel = userChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id);
			let userChosen = userSel?.chosen ?? [];
			let bonus = userSel?.bonus?.userSelect ? userSel.bonus : undefined;
			calc.slots.forEach((scs, si) => {
				let userChoice = userChosen.find(uc => uc.slotIndex === si);
				if (calc.shuttle.state !== SHUTTLE_STATE_OPENED) {
					// Ignore used crew and find them in the roster
					let item = bonusedRoster.filter(c => c.crew.active_id === calc.shuttle.id && c.crew.active_index === si).shift();
					chosen.push({
						slotIndex: si,
						item
					});
				}
				else if (userChoice?.item) {
					chosen.push(userChoice);
				}
				else {
					let item: CrewItem | undefined = undefined;

					// Get best unused if no current provided or n-1 of every n choices
					//if (!selsCurrent || ((counter++ % every) != 0)) {
					if (!selsCurrent) {
						// Grab the first unused crew by score
						item = scs.bestCrew.filter(c => !usedCrew.has(cid(c.crew))).shift();
						//console.log("selecting first option " + ci + "," + si)
					}
					else {
						const options = scs.bestCrew.filter(c => !usedCrew.has(cid(c.crew)));
						// Weight the random selection toward the front of the list
						for (let i = 0; i < options.length; ++i) {
							const r = Math.random();
							// Select if the random value is below the curve in the higher probability range
							const gap = .6; // 60% chance of select starting with first index
							const pass = r < gap;
							if (pass) {
								item = options[i];
								break;
							}
							//console.log("skipped option " + i + " " + r + " " + ci + "," + si)
						}
						//console.log("selecting random option " + ci + "," + si)
						// Grab random selection of crew
					}
					if (item) {
						usedCrew.add(cid(item.crew))
					}

					chosen.push({
						slotIndex: si,
						item
					});
				}
			});

			if (!bonus && calc.shuttle.state === SHUTTLE_STATE_OPENED) {
				const item = availableBonuses[Math.floor(Math.random() * availableBonuses.length)];
				// ignore time boosts
				if (item && item.bonuses) {
					bonus = {
						item,
						userSelect: false,
					}
				}
			}

			sels.push({
				calc,
				chosen,
				bonus,
			});
		})

		return sels;
	}
}
