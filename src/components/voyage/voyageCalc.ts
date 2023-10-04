import STTApi, { CONFIG } from '../../api';
import { CrewData, SkillData, VoyageDescriptionDTO } from '../../api/DTO21';

export interface CalcChoice {
    slotId: number;
    choice: CrewData;
}

// export interface CalcOptions {
//     roster: CrewData[];
//     voyage_description: VoyageDescriptionDTO;
//     traitScoreBoost: number;
//     skillMatchingMultiplier: number;
//     skillSecondaryMultiplier: number;
//     skillPrimaryMultiplier: number;
//     shipAM: number;
//     extendsTarget: number;
//     searchDepth: number;
// }

// export interface CalcRemainingOptions {
//     roster: CrewData[];
//     voyage_description: VoyageDescriptionDTO;
//     traitScoreBoost: number;
//     skillMatchingMultiplier: number;
//     skillSecondaryMultiplier: number;
//     skillPrimaryMultiplier: number;
//     shipAM: number;
//     extendsTarget: number;
//     searchDepth: number;

//     assignedCrew: number[];
//     remainingAntiMatter: number;
//     voyage_duration: number;
// }

export interface CalcExportData {
    crew: CalcCrewData[];
    binaryConfig: number[];
    estimateBinaryConfig?: number[];
}

export interface CalcCrewData {
    id: number;
    name: string;
    traitBitMask: number;
    max_rarity: number;
    skillData: number[];
}

// function parseResults(result: { buffer: ArrayBuffer }, callback: (choices: CalcChoice[], hoursLeft:number) => void) : void {
//     let dv = new DataView(result.buffer);

//     let hoursLeft = dv.getFloat32(0, true);

//     let entries: CalcChoice[] = [];
//     for (let i = 0; i < 12; i++) {
//         let crewId = dv.getUint32(4 + (i * 4), true);
//         let choice = STTApi.roster.find((crew) => ((crew.crew_id === crewId) || (crew.id === crewId)));

//         if (!choice) {
//             console.log('ERROR: Calculator returned choice "'+crewId+'" not found in roster');
//             continue;
//         }

//         let entry = {
//             slotId: i,
//             choice
//         };
//         entries.push(entry);
//     }

//     callback(entries, hoursLeft);
// }

// remove non-ascii and replace double-quotes in names with single quotes. Must be done when transmitting
// to native code to prevent JSON/CSV parse errors, and then again on the app to match against names sent
export function cleanCrewName(name: string) : string {
    return name.replace(/[^\x00-\x7F]/g, "").replace(/"/g, "'")
}

// export function exportVoyageData(options: CalcOptions): CalcExportData {
//     let dataToExport: CalcExportData = {
//         // These values get filled in the following code
//         crew: [],
//         binaryConfig: []
//     };

//     let binaryConfigBuffer = new ArrayBuffer(34);
//     let binaryConfig = new DataView(binaryConfigBuffer);
//     binaryConfig.setUint8(0, options.searchDepth);
//     binaryConfig.setUint8(1, options.extendsTarget);
//     binaryConfig.setUint16(2, options.shipAM, true);
//     binaryConfig.setFloat32(4, options.skillPrimaryMultiplier, true);
//     binaryConfig.setFloat32(8, options.skillSecondaryMultiplier, true);
//     binaryConfig.setFloat32(12, options.skillMatchingMultiplier, true);
//     binaryConfig.setUint16(16, options.traitScoreBoost, true);

//     // 18 is primary_skill
//     // 19 is secondary_skill
//     // 20 - 32 is voyage_crew_slots

//     binaryConfig.setUint16(32, 0/*crew.size*/, true);

//     let voyage_description = options.voyage_description;
//     const SLOT_COUNT = voyage_description.crew_slots.length;
//     console.assert(SLOT_COUNT === 12, 'Ooops, voyages have more than 12 slots !? The algorithm needs changes.');

//     // Find unique traits used in the voyage slots
//     let setTraits = new Set<string>();
//     voyage_description.crew_slots.forEach((slot) => {
//         setTraits.add(slot.trait);
//     });

//     let arrTraits : string[] = Array.from(setTraits);
//     let skills = Object.keys(CONFIG.SKILLS);

//     // Replace traits and skills with their id
//     let slotTraitIds: number[] = [];
//     for (let i = 0; i < voyage_description.crew_slots.length; i++) {
//         let slot = voyage_description.crew_slots[i];

//         binaryConfig.setUint8(20 + i, skills.indexOf(slot.skill));
//         slotTraitIds[i] = arrTraits.indexOf(slot.trait);
//     }

//     binaryConfig.setUint8(18, skills.indexOf(voyage_description.skills.primary_skill));
//     binaryConfig.setUint8(19, skills.indexOf(voyage_description.skills.secondary_skill));

//     options.roster.forEach((crew) => {
//         let traitIds: number[] = [];
//         crew.rawTraits.forEach((trait) => {
//             if (arrTraits.indexOf(trait) >= 0) {
//                 traitIds.push(arrTraits.indexOf(trait));
//             }
//         });

//         let traitBitMask: number = 0;
//         for (let nFlag = 0; nFlag < SLOT_COUNT; nFlag++) {
//             let hasTrait : boolean = traitIds.indexOf(slotTraitIds[nFlag]) >= 0;
//             traitBitMask |= (hasTrait ? 1 : 0) << nFlag;
//         }

//         // We store traits in the first 12 bits, using the next few for flags
//         traitBitMask |= ((crew.frozen > 0) ? 1 : 0) << SLOT_COUNT;
//         traitBitMask |= ((crew.active_id && (crew.active_id > 0)) ? 1 : 0 )<< (SLOT_COUNT + 1);
//         traitBitMask |= ((crew.level == 100 && crew.rarity == crew.max_rarity) ? 1 : 0) << (SLOT_COUNT + 2); // ff100

//         // Replace skill data with a binary blob
//         let buffer = new ArrayBuffer(6 /*number of skills */ * 3 /*values per skill*/ * 2 /*we need 2 bytes per value*/);
//         let skillData = new Uint16Array(buffer);
//         for (let i = 0; i < skills.length; i++) {
//             let sd: SkillData = crew.skills[skills[i]];
//             skillData[i * 3] = sd ? sd.core : 0;
//             skillData[i * 3 + 1] = sd ? sd.min : 0;
//             skillData[i * 3 + 2] = sd ? sd.max : 0;
//         }

//         // This won't be necessary once we switch away from Json to pure binary for native invocation
//         let newCrew: CalcCrewData = {
//             id: crew.crew_id ? crew.crew_id : crew.id,
//             name: cleanCrewName(crew.name),
//             traitBitMask: traitBitMask,
//             max_rarity: crew.max_rarity,
//             skillData: Array.from(skillData)
//         };

//         dataToExport.crew.push(newCrew);
//     });

//     binaryConfig.setUint16(32, dataToExport.crew.length, true);

//     dataToExport.binaryConfig = Array.from(new Uint8Array(binaryConfigBuffer));

//     return dataToExport;
// }

// function invokeNative(dataToExport: CalcExportData,
//         progressCallback: (progressResult: { buffer: ArrayBuffer }) => void,
//         doneCallback: (progressResult: { buffer: ArrayBuffer }) => void) : void {
// // #!if ENV === 'electron'
//     const NativeExtension = require('electron').remote.require('stt-native');
//     NativeExtension.calculateVoyageRecommendations(JSON.stringify(dataToExport), doneCallback, progressCallback);
// // #!else
//     let ComputeWorker = require("worker-loader?name=wasmWorker.js!../../components/wasmWorker");

//     const worker = new ComputeWorker();
//     worker.addEventListener('message', (message: any) => {
//         if (message.data.progressResult) {
//             progressCallback(Uint8Array.from(message.data.progressResult));
//         } else if (message.data.result) {
//             doneCallback(Uint8Array.from(message.data.result));
//         }
//     });

//     worker.postMessage(dataToExport);
// // #!endif
// }
//
// export function calculateVoyage(options: CalcOptions,
//         progressCallback: (choices: CalcChoice[], hoursLeft: number) => void,
//         doneCallback: (choices: CalcChoice[], hoursLeft: number) => void) : void {
//     let dataToExport = exportVoyageData(options);
//     invokeNative(dataToExport, (progressResult: { buffer: ArrayBuffer}) => {
//         parseResults(progressResult, progressCallback);
//     }, (result: { buffer: ArrayBuffer }) => {
//         parseResults(result, doneCallback);
//     });
// }

// export function estimateVoyageRemaining(options: CalcRemainingOptions, callback: (minutesLeft:number) => void) : void {
//     let dataToExport = exportVoyageData(options);

//     let binaryConfigBuffer = new ArrayBuffer(52);
//     let binaryConfig = new DataView(binaryConfigBuffer);

//     let voy_mins = options.voyage_duration / 60;
//     let voy_hours = voy_mins / 60;
//     let offMins = Math.floor(voy_hours) * 60;
//     voy_mins -= offMins;

//     // Sent as two parts to avoid float representation mangling on the native side
//     binaryConfig.setUint8(0, Math.floor(voy_hours)); // elapsedTimeHours
//     binaryConfig.setUint8(1, Math.floor(voy_mins)); // elapsedTimeMinutes
//     binaryConfig.setUint16(2, options.remainingAntiMatter, true);

//     console.assert(options.assignedCrew.length === 12, 'Ooops, voyages have more than 12 slots !? The algorithm needs changes.');
//     for (let i = 0; i < options.assignedCrew.length; i++) {
//         binaryConfig.setUint32(4 + 4 * i, options.assignedCrew[i], true);
//     }

//     dataToExport.estimateBinaryConfig = Array.from(new Uint8Array(binaryConfigBuffer));

//     invokeNative(dataToExport, (progressResult) => {
//         // Don't care
//     }, (result: { buffer: ArrayBuffer }) => {
//         let dv = new DataView(result.buffer);
//         let scoreInHours = dv.getFloat32(0, true);
//         callback(scoreInHours * 60);
//     });

//     //callback(options.remainingAntiMatter / 21);
// }
