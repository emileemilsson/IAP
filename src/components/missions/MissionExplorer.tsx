import React from 'react';

import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';
import { Dropdown, DropdownMenuItemType, IDropdownOption } from 'office-ui-fabric-react/lib/Dropdown';

import STTApi from '../../api';

import { MissionDetails } from './MissionDetails';
import { MissionData } from '../../api/DTO21';

interface MissionExplorerProps {
	onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

interface MissionExplorerState {
	dataAvailable: boolean;
	selectedItem?: MissionOptions;
	onlyIncomplete: boolean;
	options: MissionOptions[];
}

interface MissionOptions extends IDropdownOption {
	data?: {
		mission: string;
		questId: number;
	};
}

export class MissionExplorer extends React.Component<MissionExplorerProps, MissionExplorerState> {
	constructor(props: MissionExplorerProps) {
		super(props);

		this.loadOptions = this.loadOptions.bind(this);

		this.state = {
			dataAvailable: true,
			selectedItem: undefined,
			onlyIncomplete: false,
			options: this.loadOptions(false)
		};
	}

	componentDidMount() {
		this._updateCommandItems();
	}

	componentDidUpdate(_prevProps: MissionExplorerProps, prevState: MissionExplorerState) {
		if (this.state.options.length !== prevState.options.length) {
			if (!this.state.options.find(opt => opt.key === this.state.selectedItem?.key)) {
				this.setState({ selectedItem: undefined });
			}
		}
	}

	_updateCommandItems() {
		if (this.props.onCommandItemsUpdate) {
			this.props.onCommandItemsUpdate([{
				key: 'settings',
				text: 'Settings',
				iconProps: { iconName: 'Equalizer' },
				subMenuProps: {
					items: [{
						key: 'onlyIncomplete',
						text: 'Show only unfinished missions',
						canCheck: true,
						isChecked: this.state.onlyIncomplete,
						onClick: () => {
							const isChecked = !this.state.onlyIncomplete;
							this.setState({
								options: this.loadOptions(isChecked),
								onlyIncomplete: isChecked,
							}, () => { this._updateCommandItems(); });
						}
					}]
				}
			}]);
		}
	}

	_sortMissions(a: MissionData, b: MissionData): number {
		// sort CADET missions (by id),
		// then DISTRESS CALLS (alphabetically),
		// then EPISODES (numerically)
		const isCadetA = a.quests[0].cadet;
		const isCadetB = b.quests[0].cadet;
		if (isCadetA && !isCadetB) { return -1; }
		if (!isCadetA && isCadetB) { return 1; }
		if (isCadetA && isCadetB) { return a.id - b.id; }

		const episodeNumA = a.episode_title.startsWith('Episode')
			? Number(a.episode_title.substr(8, 2))
			: -1;
		const isEpisodeA = episodeNumA > 0;
		const episodeNumB = b.episode_title.startsWith('Episode')
			? Number(b.episode_title.substr(8, 2))
			: -1;
		const isEpisodeB = episodeNumB > 0;
		const isDistressA = !isCadetA && !isEpisodeA;
		const isDistressB = !isCadetB && !isEpisodeB;
		if (isDistressA && !isDistressB) { return -1; }
		if (!isDistressA && isDistressB) { return 1; }
		if (isDistressA && isDistressB) { return a.episode_title.localeCompare(b.episode_title); }

		return episodeNumA - episodeNumB;
	}

	loadOptions(onlyIncomplete: boolean) : MissionOptions[] {
		let options: MissionOptions[] = [];
		STTApi.missions.sort(this._sortMissions).forEach((mission) => {
			if (mission.quests.length == 0) return;
			if (onlyIncomplete && (mission.stars_earned == mission.total_stars)) return;

			const labelPrefix = mission.quests[0].cadet
				? 'CADET: '
				: mission.episode_title.startsWith('Episode')
					? ''
					: 'Distress Calls: ';
			const missionLabel = `${labelPrefix}${mission.episode_title} (${mission.stars_earned} / ${mission.total_stars})`;

			options.push({
				key: mission.episode_title + mission.id,
				text: missionLabel,
				itemType: DropdownMenuItemType.Header
			});
			let found = false;
			mission.quests.forEach((quest) => {
				if (quest.quest_type === 'ConflictQuest') {
					if (onlyIncomplete) {
						let goals = quest.mastery_levels[0].progress.goals + quest.mastery_levels[1].progress.goals + quest.mastery_levels[2].progress.goals;
						let goal_progress = quest.mastery_levels[0].progress.goal_progress + quest.mastery_levels[1].progress.goal_progress + quest.mastery_levels[2].progress.goal_progress;
						if (goals == goal_progress) return;
					}

					options.push({
						key: quest.name + quest.id,
						text: quest.name,
						data: {
							mission: mission.episode_title,
							questId: quest.id
						}
					});
					found = true;
				}
			});

			if (!found) {
				// mission only contains space battle quests, so remove "header" option
				options.pop();
			}
		});

		return options;
	}

	_onRenderTitle(options?: MissionOptions[]): JSX.Element {
		if (options && options.length > 0) {
			const option = options[0];
			return (<div>
				<span><b>{option.data ? option.data.mission : 'UNKNOWN'} : </b></span>
				<span>{option.text}</span>
			</div>);
		}
		return (<div></div>);
	}

	render() {
		if (this.state.dataAvailable) {
			return (
				<div className='mission-page'>
					<div className='mission-header'>
						<h1>Missions</h1>
						<Dropdown
							className='mission-selection'
							selectedKey={this.state.selectedItem?.key}
							onChange={(_evt, item) => {
								this.setState({ selectedItem: item });
							}}
							onRenderTitle={this._onRenderTitle}
							placeholder='Select a mission'
							options={this.state.options}
						/>
						<hr/>
					</div>
					<div className='mission-content'>
						<MissionDetails
							questId={this.state.selectedItem} />
					</div>
				</div>
			);
		}
		else {
			return <div className="centeredVerticalAndHorizontal">
				<div className="ui huge centered text active inline loader">Loading mission and quest data...</div>
			</div>;
		}
	}
}
