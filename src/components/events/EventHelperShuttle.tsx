import React from 'react';
import { EventDTO, EVENT_TYPES } from "../../api/DTO21";
import { Label } from 'semantic-ui-react';
import { EventCrewBonusTable, EventStat } from './EventHelperPage';
import STTApi from '../../api';

export const ShuttleEvent = (props: {
	event: EventDTO;
	onTabSwitch?: (newTab: string) => void;
}) => {
	if (!props.event ||
		!props.event.content ||
		props.event.content.content_type !== EVENT_TYPES.SHUTTLES ||
		!props.event.content.shuttles
	) {
		return <span />;
	}
	let eventVP = props.event.content.shuttles![0].shuttle_mission_rewards.find(r => r.type === 11);
	let eventShuttleVP = eventVP ? eventVP.quantity : 0

	const vpCurr = props.event.victory_points ?? 0;
	const vpTopThresh = props.event.threshold_rewards[props.event.threshold_rewards.length - 1].points;

	let shuttlesToGo = undefined;
	if (eventShuttleVP > 0) {
		shuttlesToGo = (vpTopThresh - vpCurr) / eventShuttleVP;
	}

	let shPerBatch = undefined;
	let vpMinimum = undefined;
	const bays = STTApi.playerData.character.shuttle_bays;
	if (props.event.opened_phase !== undefined && eventShuttleVP > 0 && shuttlesToGo) {
		let secondsToEnd = props.event.phases[props.event.opened_phase].seconds_to_end;
		let hoursToEnd = secondsToEnd / (60 * 60);
		let threeHourSlotsToEnd = hoursToEnd / 3;

		shPerBatch = shuttlesToGo / threeHourSlotsToEnd;

		vpMinimum = bays * threeHourSlotsToEnd * eventShuttleVP;
	}

	return <div>
		<h3>Faction event: {props.event.name}</h3>
		<div>
			<EventStat label="Current Shuttle VP" value={eventShuttleVP ?? 'unknown'} />
		</div>
		{vpTopThresh > vpCurr && <div>
			<h4>To achieve top threshold reward in this phase:</h4>
			<EventStat label="Shuttle Successes" value={shuttlesToGo ?? 'unknown'} />
			<EventStat label="Shuttle Successes every 3 hours" value={shPerBatch ?? 'unknown'} />
			<EventStat label={"VP for "+ bays+" bays every 3 hours"} value={vpMinimum ?? 'unknown'} />
		</div>}
		<div style={{ margin: '0' }}>
			<span>
				{props.onTabSwitch &&
					<span>Click to see shuttle details: <Label as='a'
						onClick={() => props.onTabSwitch && props.onTabSwitch('Shuttles')}>Shuttle Details</Label></span>
				}
				<EventCrewBonusTable bonuses={props.event.content.shuttles[0].crew_bonuses} />
			</span>
		</div>
	</div>;
}
