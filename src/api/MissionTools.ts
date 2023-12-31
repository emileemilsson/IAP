import STTApi from "./index";
import { AcceptedMissionsDTO, MissionData, MissionQuestDTO, MissionDisputeHistoryDTO, MissionCadetScheduleDTO } from "./DTO";

async function loadQuestData(completed: boolean, quest: MissionQuestDTO) {
	// The mission is incomplete, but maybe the quest itself is complete and already cached
	if (!completed) {
		if (quest.mastery_levels) {
			let goals = quest.mastery_levels[0].progress.goals + quest.mastery_levels[1].progress.goals + quest.mastery_levels[2].progress.goals;
			let goal_progress = quest.mastery_levels[0].progress.goal_progress + quest.mastery_levels[1].progress.goal_progress + quest.mastery_levels[2].progress.goal_progress;

			completed = goals === goal_progress;
		}
	}

	if (completed)
	{
		let entry = await STTApi.quests.where('id').equals(quest.id).first();
		if (entry) {
			//console.info('Found ' + quest.id + ' in the quest cache');
			quest.description = entry.description;
			quest.challenges = entry.challenges;
			quest.mastery_levels = entry.mastery_levels;

			// For cadet challenges
			quest.cadet = entry.cadet;
			quest.crew_requirement = entry.crew_requirement;
		} else {
			console.log(`Loading completed quest not yet in cache '${quest.name}'.`)
			await loadConflictInfo(quest);
		}
	}
	else {
		await loadConflictInfo(quest);
	}
}

async function loadConflictInfo(quest: MissionQuestDTO) {
	let data = await STTApi.executeGetRequest("quest/conflict_info", { id: quest.id });
	if (!data.mastery_levels) {
		throw new Error('Invalid data for quest conflict!');
	}

	quest.description = data.description;
	quest.challenges = data.challenges;
	quest.mastery_levels = data.mastery_levels;

	// For cadet challenges
	quest.cadet = data.cadet;
	quest.crew_requirement = data.crew_requirement;

	// We don't need to await here, it's just caching and it can happen whenever, no need to hold up the rest of the loading sequence for it
	STTApi.quests.put({
		id: quest.id,
		description: quest.description,
		challenges: quest.challenges,
		mastery_levels: quest.mastery_levels,
		cadet: quest.cadet ?? false,
		crew_requirement: quest.crew_requirement
	});
}

export async function loadMissionData(
	accepted_missions: (MissionCadetScheduleDTO | AcceptedMissionsDTO)[],
	dispute_histories: MissionDisputeHistoryDTO[]
): Promise<MissionData[]> {
	let mission_ids: any[] = [];

	accepted_missions.forEach((mission) => {
		if ((mission as AcceptedMissionsDTO).symbol !== 'mission_npev2') {
			// Ignore the tutorial episode
			mission_ids.push(mission.id);
		}
	});

	// Add all the episodes' missions (if not cadet)
	if (dispute_histories) {
		dispute_histories.forEach((dispute) => {
			if (dispute.symbol === 'dispute_logic_under_fire_NPE') {
				return; // Ignore the tutorial dispute
			}

			mission_ids = mission_ids.concat(dispute.mission_ids);
		});
	}

	let data = await STTApi.executeGetRequest("mission/info", { ids: mission_ids });
	let missions: MissionData[] = [];
	let questPromises: Promise<void>[] = [];

	data.character.accepted_missions.forEach((mission: AcceptedMissionsDTO) => {
		if (mission.symbol === 'mission_npev2') {
			return; // Ignore the tutorial episode
		}

		if (mission.episode_title) {
			let missionData: MissionData = {
				id: mission.id,
				episode_title: mission.episode_title,
				episode: mission.episode,
				description: mission.description,
				stars_earned: mission.stars_earned,
				total_stars: mission.total_stars,
				quests: []
			};

			if (mission.episode && mission.episode > 0) {
				missionData.episode_title =`Episode ${mission.episode} : ${mission.episode_title}`;
			}

			mission.quests.forEach((quest) => {
				if ((!quest.locked) && quest.name) {
					if (quest.quest_type === 'ConflictQuest') {
						questPromises.push(loadQuestData(mission.stars_earned === mission.total_stars, quest));
					}
					else {
						quest.description = 'Ship battle';
					}

					missionData.quests.push(quest);
				}
			});

			missions.push(missionData);
		}
		else {
			// Could be one of the episodes
			if (dispute_histories) {
				dispute_histories.forEach((dispute) => {
					if (dispute.symbol === 'dispute_logic_under_fire_NPE') {
						return; // Ignore the tutorial dispute
					}

					if (dispute.mission_ids.includes(mission.id)) {
						if (!dispute.quests)
							dispute.quests = [];

						mission.quests.forEach((quest) => {
							if ((!quest.locked) && quest.name && !dispute.quests!.find((q) => q.id === quest.id)) {
								if (quest.quest_type === 'ConflictQuest') {
									questPromises.push(loadQuestData(dispute.stars_earned === dispute.total_stars, quest));
								}
								else {
									quest.description = 'Ship battle';
								}

								dispute.quests!.push(quest);
							}
						});
					}
				});
			}
		}
	});

	await Promise.all(questPromises);

	if (dispute_histories) {
		// Pretend the episodes (disputes) are missions too, to get them to show up
		dispute_histories.forEach((dispute) => {
			if (dispute.symbol === 'dispute_logic_under_fire_NPE') {
				return; // Ignore the tutorial dispute
			}

			let missionData: MissionData = {
				id: dispute.mission_ids[0],
				episode: dispute.episode,
				episode_title: 'Episode ' + dispute.episode + ' : ' + dispute.name,
				description: 'Episode ' + dispute.episode,
				stars_earned: dispute.stars_earned,
				total_stars: dispute.total_stars,
				quests: dispute.quests ?? []
			};

			missions.push(missionData);
		});
	}

	return missions;
}
