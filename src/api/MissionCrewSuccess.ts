import STTApi from "./index";
import CONFIG from "./CONFIG";
import { CrewData, MissionData, MissionQuestChallengeDTO, MissionQuestDTO, SkillData } from "./DTO21";

export interface IChallengeSuccessTrait {
    trait: string;
    bonus: number;
}

export interface IChallengeSuccessCrew {
    crew: CrewData;
    success: number;
    rollRequired: number;
    rollCrew: number;
}

export interface IChallengeSuccess {
    mission: any;
    quest: any;
    challenge: any;
    completed: boolean;
    roll: number;
    skill: string;
    cadet: boolean;
    crew_requirement: any;
    traits: IChallengeSuccessTrait[];
    lockedTraits: Array<string>;
    crew: IChallengeSuccessCrew[];
}

export function calculateMissionCrewSuccess(): Array<IChallengeSuccess> {
    let log: Array<IChallengeSuccess> = [];

    STTApi.missions.forEach((mission: any) => {
        // short circuit mission complete calculation by determining if all stars have been earned
        const missionComplete = mission.stars_earned === mission.total_stars;

        mission.quests.forEach((quest: any) => {
            let allFinished = missionComplete;
            if (!allFinished) {
                let unfinishedNodes: number[] = (quest.challenges || [])
                    .filter((ch: any) => ch.critical && !ch.critical.claimed)
                    .map((ch: any) => ch.id);

                allFinished = unfinishedNodes.length === 0;
                allFinished = allFinished && (quest.mastery_levels.reduce((accumulator: number, currentValue: any) => (accumulator + currentValue.progress.goals - currentValue.progress.goal_progress), 0) === 0);
            }
            if (quest.quest_type == 'ConflictQuest') {
                quest.challenges.forEach((challenge: any) => {
                    let entry: IChallengeSuccess = {
                        mission: mission,
                        quest: quest,
                        challenge: challenge,
                        completed: allFinished,
                        roll: 0,
                        skill: challenge.skill,
                        cadet: (quest.cadet == true) ? true : false,
                        crew_requirement: quest.crew_requirement,
                        traits: [],
                        lockedTraits: [],
                        crew: []
                    };

                    if (challenge.difficulty_by_mastery) {
                        entry.roll += challenge.difficulty_by_mastery[2];
                    }

                    if (challenge.critical && challenge.critical.threshold) {
                        entry.roll += challenge.critical.threshold;
                    }

                    let fixUp = function(trait: string): string {
                        // Replace "nonhuman" with "alien" to match the search fixup
                        if (trait === 'nonhuman') { return 'alien'; }
                        return trait;
                    }

                    if (challenge.trait_bonuses && (challenge.trait_bonuses.length > 0)) {
                        challenge.trait_bonuses.forEach((traitBonus: any) => {
                            entry.traits.push({ trait: fixUp(traitBonus.trait), bonus: traitBonus.bonuses[2] });
                        });
                    }

                    if (challenge.locks && (challenge.locks.length > 0)) {
                        challenge.locks.forEach((lock: any) => {
                            if (lock.trait) {
                                entry.lockedTraits.push(fixUp(lock.trait));
                            }
                        });
                    }

                    STTApi.roster.forEach((crew: CrewData) => {
                        let rawTraits = new Set(crew.rawTraits);

                        if (entry.cadet) {
                            if ((crew.max_rarity < entry.crew_requirement.min_stars) || (crew.max_rarity > entry.crew_requirement.max_stars)) {
                                return; // Doesn't meet rarity requirements
                            }

                            if (entry.crew_requirement.traits && (entry.crew_requirement.traits.length > 0)) {
                                let matchingTraits: number = entry.crew_requirement.traits.filter((trait: string) => rawTraits.has(fixUp(trait))).length;
                                if (matchingTraits != entry.crew_requirement.traits.length)
                                    return; // Doesn't meet trait requirements
                            }
                        }

                        if (entry.lockedTraits.length > 0) {
                            let matchingTraits: number = entry.lockedTraits.filter((trait: string) => rawTraits.has(trait)).length;
                            if (matchingTraits == 0)
                                return; // Node is locked by a trait which this crew doesn't have
                        }

                        // Compute roll for crew
                        let csk: SkillData = crew.skills[entry.skill];

                        let rollCrew = csk.core;

                        // If crew doesn't have a skill, its default value is lowest_skill / 5
                        if (rollCrew === 0) {
                            let lowestSkill = 99999;
                            for (let skill in CONFIG.SKILLS) {
                                const coreSkill = crew.skills[skill].core;
                                if ((coreSkill > 0) && (lowestSkill > coreSkill)) {
                                    lowestSkill = coreSkill;
                                }
                            }

                            rollCrew = lowestSkill * STTApi.serverConfig!.config.conflict.untrained_skill_coefficient;
                        }

                        if (entry.traits && (entry.traits.length > 0)) {
                            let matchingTraits: number = entry.traits.filter((traitBonus: any) => rawTraits.has(traitBonus.trait)).length;
                            rollCrew += matchingTraits * entry.traits[0].bonus;
                        }

                        if (rollCrew + csk.max > entry.roll) // Does this crew even have a chance?
                        {
                            let successPercentage: number = (rollCrew + csk.max - entry.roll) * 100 / (csk.max - csk.min);
                            if (successPercentage > 100) {
                                successPercentage = 100;
                            }

                            entry.crew.push({ crew: crew, success: successPercentage, rollRequired: entry.roll, rollCrew: rollCrew});
                        }
                    });

                    entry.crew.sort((a: IChallengeSuccessCrew, b: IChallengeSuccessCrew) => b.success - a.success);

                    log.push(entry);
                });
            }
        });
    });

    return log;
}

export function calculateMinimalComplementAsync(): void {
    /*let ComputeWorker = require("worker-loader?name=computeWorker.js!./computeWorker");

    const worker: Worker = new ComputeWorker();
    worker.addEventListener('message', (message: any) => {
        STTApi.minimalComplement = message.data;
    });
    worker.postMessage({ success: STTApi.missionSuccess });*/
}

export interface ICrewPath {
    path: number[];
    crew: IChallengeSuccessCrew[];
    success: number;
}

export interface IQuestMission extends MissionQuestDTO {
    difficulty_by_mastery?: number[];
    critical_threshold?: number;
    trait_bonuses?: number[];
}

export interface IQuestRecommendations {
    mission?: IQuestMission;
    bestCrewPaths?: ICrewPath[];
    allFinished: boolean;
}

export function calculateQuestRecommendations(questId: number, masteryIndex: number, loadEvenFinishedNodes: boolean): IQuestRecommendations {
    let mission: IQuestMission | undefined;
    STTApi.missions.forEach((episode) => {
        episode.quests.forEach((quest: MissionQuestDTO) => {
            if (quest.id === questId) {
                mission = quest;
            }
        });
    });

    if (!mission) {
        return {
            mission: undefined,
            bestCrewPaths: undefined,
            allFinished: false
        };
    }

    // Get the numbers from the first challenge that has them (since they match across the quest)
    mission.challenges?.forEach((challenge: MissionQuestChallengeDTO) => {
        if (challenge.difficulty_by_mastery) {
            mission!.difficulty_by_mastery = challenge.difficulty_by_mastery;
        }

        if (challenge.critical && challenge.critical.threshold) {
            mission!.critical_threshold = challenge.critical.threshold;
        }

        if (challenge.trait_bonuses && (challenge.trait_bonuses.length > 0)) {
            mission!.trait_bonuses = challenge.trait_bonuses[0].bonuses;
        }
    });

    // This algorithm assumes the graph is acyclic
    let nodeElem: { [index: number]: MissionQuestChallengeDTO } = {};
    let unfinishedNodes: number[] = [];
    mission.challenges?.forEach(challenge => {
        nodeElem[challenge.id] = challenge;

        const unclaimedCritical = mission?.mastery_levels[masteryIndex].jackpots
            .find(jp => (jp.id === challenge.id) && !jp.claimed);
        if (unclaimedCritical) {
            unfinishedNodes.push(challenge.id)
        }
    });

    // DFS to build all possible paths through the graph
    let paths: number[][] = [];
    const buildTree = (index: number, path: number[]) => {
        let newPath = path.slice(0);
        newPath.push(index);
        if (nodeElem[index].children && nodeElem[index].children.length > 0) {
            nodeElem[index].children.forEach(child => {
                buildTree(child, newPath);
            });
        }
        else {
            // Reached an end-node, record the path
            paths.push(newPath);
        }
    };
    buildTree(0, []);

    // Eliminate paths that are all done (don't include any unfinished node)
    if (!loadEvenFinishedNodes) {
        paths = paths.filter(path => {
            return path.filter(node => unfinishedNodes.indexOf(node) > -1).length > 0;
        });
    }

    // NOTE: this algorithm doesn't consider crew selections where you intentionally fail a node (all nodes must have success > 0)
    let bestCrewPaths: ICrewPath[] = [];

    // Calculate optimal crew selection for each path
    // WARNING - computationally intensive (consider showing a progress and using a WebWorker to unblock the UI thread)
    paths.forEach(path => {
        let crewSelections: IChallengeSuccessCrew[][] = [];
        const pathStep = (level: number, crewSelection: IChallengeSuccessCrew[]) => {
            if (path.length === level) {
                crewSelections.push(crewSelection);
                return;
            }

            let recommendations = STTApi.missionSuccess.find(missionSuccess => (missionSuccess.quest.id === mission!.id) && (missionSuccess.challenge.id === path[level]));
            if (recommendations && recommendations.crew.length > 0) {
                recommendations.crew.forEach(recommendation => {
                    // If we already picked 3 crew, all subsequent choices must be from those 3
                    if ((crewSelection.length < 3) || (crewSelection.find(selection => selection.crew.id == recommendation.crew.id))) {
                        let newCrewSelection = crewSelection.slice(0);
                        newCrewSelection.push(recommendation);
                        pathStep(level + 1, newCrewSelection);
                    }
                });
            }
        };
        pathStep(0, []);

        // Apply tired crew coefficient and sort crew selections by total success
        const totalSuccess = (crewSelection: IChallengeSuccessCrew[]) => {
            let min = crewSelection[0].success;
            let total = crewSelection[0].success;
            for (let i = 1; i < crewSelection.length; i++) {
                if (crewSelection[i].crew.id == crewSelection[i - 1].crew.id) {
                    // If crew is used on consecutive nodes, it gets -20% to skill rating
                    let skill = nodeElem[path[i]].skill;
                    let tiredSuccess = ((crewSelection[i].rollCrew + crewSelection[i].crew.skills[skill].max) * STTApi.serverConfig!.config.conflict.tired_crew_coefficient - crewSelection[i].rollRequired) * 100 /
                        (crewSelection[i].crew.skills[skill].max - crewSelection[i].crew.skills[skill].min);
                    if (tiredSuccess > 100) {
                        tiredSuccess = 100;
                    }
                    if (tiredSuccess < min) {
                        min = tiredSuccess;
                    }
                    total += tiredSuccess;
                }
                else {
                    if (crewSelection[i].success < min) {
                        min = crewSelection[i].success;
                    }
                    total += crewSelection[i].success;
                }
            }
            return {total, min};
        };

        // Filter out the selections that now are no longer feasible after applying the tired crew coefficient
        crewSelections = crewSelections.filter(crewSelection => totalSuccess(crewSelection).min > 0);

        crewSelections.sort((a,b) => totalSuccess(b).total - totalSuccess(a).total);

        if (crewSelections.length > 0) {
            bestCrewPaths.push({path, crew: crewSelections[0], success: totalSuccess(crewSelections[0]).min});
        }
    });

    const allFinished = unfinishedNodes.length === 0;
    return { mission, bestCrewPaths, allFinished };
}
