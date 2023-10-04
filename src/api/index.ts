export { STTApiClass } from "./STTApi";
export { mergeDeep } from './ObjectMerge';
export { loginSequence } from './LoginSequence';
export { loadFullTree } from './EquipmentTools';
export { loadVoyage } from '../components/voyage/VoyageTools';
export { RarityStars } from '../utils/RarityStars';
export { CollapsibleSection } from '../utils/CollapsibleSection';
export { NumberPicker } from '../utils/NumberPicker';
export { CrewSkills } from '../components/crew/SkillCell';
export { download } from '../utils/pal';
export { formatCrewStatsVoy } from '../components/crew/CrewTools';
export { bonusCrewForCurrentEvent } from '../components/events/EventTools';
export { calculateQuestRecommendations, IQuestRecommendations } from './MissionCrewSuccess';
export { formatTimeSeconds } from './MiscTools';
export { refreshAllFactions, loadFactionStore } from '../components/factions/FactionTools';
export { getCrewDetailsLink, getItemDetailsLink } from './LinkProvider';
import CONFIG from "./CONFIG";
export { CONFIG }

import { STTApiClass } from "./STTApi";
let STTApi = new STTApiClass();
export default STTApi;

export function getChronitonCount(): number {
   let chronCount: number = STTApi.playerData.character.replay_energy_overflow;
   if (STTApi.playerData.character.seconds_from_replay_energy_basis === -1) {
      chronCount += STTApi.playerData.character.replay_energy_max;
   } else {
      chronCount += Math.min(Math.floor(STTApi.playerData.character.seconds_from_replay_energy_basis / STTApi.playerData.character.replay_energy_rate), STTApi.playerData.character.replay_energy_max);
   }

   return chronCount;
}
