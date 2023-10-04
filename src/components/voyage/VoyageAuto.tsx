import React from 'react';
import Moment from 'moment';
import { VoyageDTO } from '../../api/DTO';
import STTApi, { loadVoyage, formatTimeSeconds } from '../../api';
import { VOYAGE_AM_DECAY_PER_MINUTE } from './VoyageTools';

const AUTORECALL_AM_MINIMUM = 100;
const AUTORECALL_BUFFER_MINUTES = 5;
const AUTODILEMMA_BUFFER_MINUTES = 10;

const DILEMMA_CHOICES: { [key: string]: number } = {
	'A Higher Duty, Part 1': 0,
	'A Higher Duty, Part 2': 1,
	'A Higher Duty, Part 3': 1, // dr leonard
	'A Life Alone, Part 1': 0,
	'A Life Alone, Part 2': 0, // jannar
	'Champion of the People, Part 1': 0,
	'Champion of the People, Part 2': 1,
	'Champion of the People, Part 3': 0, // ensign picard
	'Interference, Part 1': 1,
	'Interference, Part 2': 0, // lucien
	'Off the Books, Part 1': 0,
	'Off the Books, Part 2': 1, // thot gor
	'The Beginning of the End of the World': 0,
	'The Voice of the Prophets': 2, // clown
}

export const VoyageAuto = (props:{
	refresh: () => void;
	recall: () => void;
	choose: (index:number) => void;
}) => {

	const [onRecall, setOnRecall] = React.useState(false);
	const [msgDilemma, setMsgDilemma] = React.useState('');
	const [msgRecall, setMsgRecall] = React.useState('');

	React.useEffect(() => {
		if (STTApi.voyAutoRecall) {
			let timerHandle : number | undefined = undefined;
			setMsgRecall('initializing auto recall daemon');

			checkAndRecall();

			return () => {
				if (timerHandle) {
					setMsgRecall('disabling auto recall daemon ' + timerHandle);
					window.clearTimeout(timerHandle);
					setMsgRecall('');
				}
			};

			async function checkAndRecall() {
				if (timerHandle) {
					window.clearTimeout(timerHandle);
					timerHandle = undefined;
				}

				let voyage: VoyageDTO = STTApi.playerData.character.voyage[0];
				if (voyage && voyage.id) {
					await loadVoyage(voyage.id, false);
					if (voyage.state === 'recalled' || voyage.state === 'failed') {
						setMsgRecall('Recall timer not necessary; voyage is ' + voyage.state);
						setOnRecall(true);
						return;
					}
					let am = voyage.hp;

					if (am < AUTORECALL_AM_MINIMUM) {
						setMsgRecall('AM has reached critical ' + am + ' recalling...');
						setOnRecall(true);
						props.recall();
						return;
					}

					const secondsToNextDilemma = voyage.seconds_between_dilemmas - voyage.seconds_since_last_dilemma;
					const estSecondsLeft = voyage.hp / VOYAGE_AM_DECAY_PER_MINUTE * 60;
					if (estSecondsLeft < secondsToNextDilemma) {
						const delay_sec = (estSecondsLeft - (AUTORECALL_BUFFER_MINUTES * 60));
						if (delay_sec <= 0) {
							setMsgRecall('Estimated time left ('+formatTimeSeconds(estSecondsLeft)+') is less than buffer; recalling...');
							props.recall();
							setOnRecall(true);
							return;
						}
						setMsgRecall('Recall timer set for ' + formatTimeSeconds(delay_sec) + ' at ' +
							Moment().add(delay_sec, 's').format('h:mma'));

						timerHandle = window.setTimeout(checkAndRecall, delay_sec * 1000);
					}
					else if (secondsToNextDilemma > 0) {
						// Delay slightly more than the dilemma time
						const delay_sec = secondsToNextDilemma + (AUTORECALL_BUFFER_MINUTES * 60);
						setMsgRecall('Recall timer check set after next dilemma for ' + formatTimeSeconds(delay_sec) + ' at ' +
							Moment().add(delay_sec, 's').format('h:mma'));

						timerHandle = window.setTimeout(checkAndRecall, delay_sec * 1000);
						props.refresh();
					}
					else {
						// Delay the smaller of one hour or estimate if waiting on a dilemma
						//NOTE: this can be problematic if the dilemma is reached within the recall threshold
						const delay_sec = Math.min(estSecondsLeft, 3600);
						setMsgRecall('Recall timer check set for ' + formatTimeSeconds(delay_sec) + ' at ' +
							Moment().add(delay_sec, 's').format('h:mma'));

						timerHandle = window.setTimeout(checkAndRecall, delay_sec * 1000);
						props.refresh();
					}
				}
			}
		}
	}, [STTApi.voyAutoRecall]);

	React.useEffect(() => {
		if (STTApi.voyAutoDilemma) {
			let timerHandle: number | undefined = undefined;
			setMsgDilemma('initializing auto dilemma daemon');

			checkAndSelect();

			return () => {
				if (timerHandle) {
					setMsgDilemma('disabling auto dilemma daemon ' + timerHandle);
					window.clearTimeout(timerHandle);
					setMsgDilemma('');
				}
			};

			async function checkAndSelect() {
				if (timerHandle) {
					window.clearTimeout(timerHandle);
					timerHandle = undefined;
				}

				let voyage: VoyageDTO = STTApi.playerData.character.voyage[0];
				if (voyage && voyage.id) {
					await loadVoyage(voyage.id, false);
					if (voyage.state === 'recalled' || voyage.state === 'failed') {
						setMsgDilemma('Dilemma timer not necessary; voyage is ' + voyage.state);
						setOnRecall(true);
						return;
					}

					let secondsToNextDilemma = voyage.seconds_between_dilemmas - voyage.seconds_since_last_dilemma;
					if (secondsToNextDilemma <= 0) {
						if (voyage.dilemma) {
							let keys = Object.keys(DILEMMA_CHOICES).filter(k => voyage.dilemma!.title.includes(k))
							if (keys.length > 0) {
								setMsgDilemma('Found dilemma key \''+keys[0]+'\' index:' + keys[0]);
								props.choose(DILEMMA_CHOICES[keys[0]]);
							}
							else {
								// find the first dilemma not locked
								voyage.dilemma.resolutions.filter(res => !res.locked).some(res => {
									let idx = voyage.dilemma!.resolutions.indexOf(res);
									if (idx >= 0)
										props.choose(idx);
								});
							}
						}
						secondsToNextDilemma = 2 * 60 * 60;
					}
					if (secondsToNextDilemma > 0) {
						// Delay slightly more than the dilemma time
						const delay_sec = secondsToNextDilemma + (AUTODILEMMA_BUFFER_MINUTES * 60);
						setMsgDilemma('Dilemma timer check set after next dilemma for ' + formatTimeSeconds(delay_sec) + ' at ' +
							Moment().add(delay_sec, 's').format('h:mma'));

						timerHandle = window.setTimeout(checkAndSelect, delay_sec * 1000);
					}
				}
			}
		}
	}, [STTApi.voyAutoDilemma]);


	// Provide a toggle that will turn on the voyage auto pilot
	// Potential Functionality:
	// * Email when AM reaches threshhold
	if (onRecall) {
		return <span>Auto Recall disabled: on-recall R:{msgRecall} D:{msgDilemma}</span>
	}
	return <div>
		<div>
			{STTApi.voyAutoRecall ? 'Auto Recall: Enabled' : ''}{msgRecall && ' - ' + msgRecall}
		</div>
		<div>
			{STTApi.voyAutoDilemma ? 'Auto Dilemma: Enabled' : ''}{msgDilemma && ' - ' + msgDilemma}
		</div>
	</div>;
}
