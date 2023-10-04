import React from 'react';
import { Image, List } from 'semantic-ui-react';
import { EventDTO, EVENT_TYPES, CrewData, CrewAvatarDTO } from "../../api/DTO21";
import STTApi from '../../api';
import { EventCrewBonusTable } from './EventHelperPage';

export const ExpeditionEvent = (props: {
	event: EventDTO;
	onTabSwitch?: (newTab: string) => void;
}) => {
	if (!props.event ||
		!props.event.content ||
		props.event.content.content_type !== EVENT_TYPES.EXPEDITION
	) {
		return <span />;
	}
	const [, imageCacheUpdated] = React.useState<string>('');

	let crew_bonuses : { avatar: CrewAvatarDTO, iconUrl: string }[] = [];
	let crew_bonuses_owned : {[symbol:string]: number } = {};
	props.event.content.special_crew.forEach(scSymbol => {
		let avatar = STTApi.getCrewAvatarBySymbol(scSymbol);
		if (!avatar) {
			return;
		}

		crew_bonuses.push({
			avatar,
			iconUrl: STTApi.imgUrl(avatar.icon, imageCacheUpdated)
		});

		let crew = STTApi.roster.find(c => c.symbol === avatar!.symbol);
		if (!crew) {
			return;
		}

		crew_bonuses_owned[crew.symbol] = 1;
	});

	return <div><h2>Expedition Event Details</h2>
		<div style={{ margin: '0' }}>
			<span>
				<div>
					<List horizontal>
						{crew_bonuses.map(cb => (
							<List.Item key={cb.avatar.symbol}>
								<Image avatar src={cb.iconUrl} />
								<List.Content>
									<List.Header>{cb.avatar.name}</List.Header>
								</List.Content>
							</List.Item>
						))}
					</List>
				</div>
				<h3>Owned bonus crew</h3>
				<EventCrewBonusTable
					bonuses={crew_bonuses_owned}
					onlyBonusCrew={true}
					hideBonus={true}
					/>
			</span>
		</div>
	</div>;
}
