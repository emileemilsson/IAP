import React from 'react';

import { Button, Item, Image, List, Accordion, Icon, AccordionTitleProps } from 'semantic-ui-react';

import { ItemDisplay } from '../utils/ItemDisplay';

import STTApi from '../api';
import { EventDTO, EventGatherPoolAdventureDTO } from '../api/DTO';

const CrewShipAbilityTable = () => {
	return <span>Hello</span>;
}

export const Experiments = () => {
	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<h2>This page contains unfinished experiments, for developer testing; you probably don't want to invoke any buttons here :)</h2>

			<CrewShipAbilityTable />

		</div>
	);
}
