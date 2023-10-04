import React from 'react';

import { IDropdownOption } from 'office-ui-fabric-react/lib/Dropdown';
import { Image } from 'office-ui-fabric-react/lib/Image';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { getTheme } from '@uifabric/styling';

import STTApi, { CONFIG, calculateQuestRecommendations, IQuestRecommendations, RarityStars } from '../../api';
import { MissionDisplay } from '../../utils/canvasutils';
import { MissionQuestChallengeDTO } from '../../api/DTO21';

interface MissionDetailsProps {
	questId?: IDropdownOption;
}

interface MissionDetailsState extends IQuestRecommendations {
	selectedChallenge?: number;
	masteryIndex: number;
}

export class MissionDetails extends React.Component<MissionDetailsProps, MissionDetailsState> {
	missionDisplay: MissionDisplay | undefined;
	canvasRef: React.RefObject<HTMLCanvasElement>;

	constructor(props: MissionDetailsProps) {
		super(props);

		this.canvasRef = React.createRef();

		this.loadMissionDetails = this.loadMissionDetails.bind(this);
		this.loadMissionDetailsInternal = this.loadMissionDetailsInternal.bind(this);
		this.updateGraph = this.updateGraph.bind(this);
		this.handleMasteryChange = this.handleMasteryChange.bind(this);

		if (!this.props.questId) {
			this.state = {
				mission: undefined,
				bestCrewPaths: undefined,
				allFinished: false,
				selectedChallenge: undefined,
				masteryIndex: 0,
			};
		}
		else {
			this.state = {
				masteryIndex: 0,
				...this.loadMissionDetailsInternal(this.props.questId.data.questId),
			};
		}
	}

	componentDidUpdate(prevProps: MissionDetailsProps, prevState: MissionDetailsState) {
		if (this.props.questId !== prevProps.questId) {
			if (this.props.questId && this.props.questId.data) {
				this.loadMissionDetails(this.props.questId.data.questId);
			}
			else {
				this.loadMissionDetails(-1);
			}
			this.updateGraph();
		}
		if ((this.state.mission !== prevState.mission)
			|| (this.state.masteryIndex !== prevState.masteryIndex)){
			this.setState({ selectedChallenge: undefined });
			this.updateGraph();
		}
		if (this.state.selectedChallenge !== prevState.selectedChallenge) {
			this.missionDisplay?.invalidate();
		}
	}

	loadMissionDetails(questId: number) {
		this.setState(this.loadMissionDetailsInternal(questId));
	}

	loadMissionDetailsInternal(questId: number): IQuestRecommendations {
		return calculateQuestRecommendations(questId, this.state.masteryIndex, false);
	}

	updateGraph() {
		if (!this.canvasRef.current) {
			return;
		}

		let mission = this.state.mission;
		if (mission) {
			let maxX = 1;
			let maxY = 1;
			mission.challenges?.forEach(challenge => {
				maxX = Math.max(challenge.grid_x, maxX);
				maxY = Math.max(challenge.grid_y, maxY);
			});

			maxX++; maxY++;

			if (this.missionDisplay) {
				this.missionDisplay.reset(maxX, maxY, this.canvasRef.current);
			} else {
				this.missionDisplay = new MissionDisplay(
					this.canvasRef.current, maxX, maxY,
					(id?: number) => this.setState({ selectedChallenge: id })
				);
			}

			let nodes = [];
			let edges = [];
			mission.challenges?.forEach(challenge => {
				let color = getTheme().palette.themeDark;
				if (challenge.critical) {
					if (!challenge.critical.claimed) {
						color = 'red';
					}
				}

				nodes.push({ id: challenge.id, label: '(' + challenge.id + ') ' + challenge.name, level: challenge.grid_x, image: CONFIG.SPRITES['icon_' + challenge.skill].url, shape: 'image', font: { color: color } });
				if (challenge.children) {
					challenge.children.forEach(child => {
						edges.push({ from: challenge.id, to: child });
					});
				}

				const unclaimedCritical = mission?.mastery_levels[this.state.masteryIndex].jackpots
					.find(jp => (jp.id === challenge.id) && !jp.claimed);
				if (this.missionDisplay) {
					this.missionDisplay.addNode(
						challenge.grid_x,
						challenge.grid_y,
						challenge.skill,
						unclaimedCritical,
						challenge.children,
						challenge.id,
						challenge.name);
				}
			});
			this.missionDisplay.invalidate();
		}
	}

	renderChallengeDetails() {
		let challenge: MissionQuestChallengeDTO | undefined;
		let mission = this.state.mission;
		if (mission) {
			mission.challenges?.forEach(item => {
				if (item.id === this.state.selectedChallenge) {
					challenge = item;
				}
			});
		}

		if (!challenge) {
			return <span />;
		}

		var traitBonuses: JSX.Element[] = [];
		challenge.trait_bonuses.map((traitBonus) => {
			traitBonuses.push(<span key={traitBonus.trait}>{STTApi.getTraitName(traitBonus.trait)}</span>);
		});

		var lockTraits: JSX.Element[] = [];
		challenge.locks.map((lock) => {
			if (lock.trait) {
				lockTraits.push(<span key={lock.trait}>{STTApi.getTraitName(lock.trait)}</span>);
			}
			else {
				const foundItem = mission!.challenges?.find(item => item.id == lock.success_on_node_id);
				lockTraits.push(<span key={lock.success_on_node_id}>Success on {foundItem ? foundItem.name : '[Unknown]'}</span>);
			}
		});

		let critical;
		const unclaimedCritical = mission?.mastery_levels[this.state.masteryIndex].jackpots
			.find(jp => (jp.id === challenge!.id) && !jp.claimed);

		if (unclaimedCritical) {
			const item = unclaimedCritical.reward[0];
			let multipleCount;
			if (item.quantity > 1) {
				multipleCount = (<span>(x {item.quantity})</span>);
			}
			critical = (<span>
				{item.full_name}
				<RarityStars asSpan={true} max={item.rarity} value={item.rarity} />
				{multipleCount}
			</span>);
		}

		let recommendations = STTApi.missionSuccess
			.find(missionSuccess =>
				(missionSuccess.quest.id == mission!.id)
				&& (missionSuccess.challenge.id == challenge!.id));
		let crewSuccess: JSX.Element[] = [];
		if (recommendations) {
			recommendations.crew.forEach(item => {
				crewSuccess.push(<Persona
					key={item.crew.name}
					imageUrl={STTApi.imgUrl(item.crew.portrait, undefined)} // should refresh on load when this is converted to a function component
					text={item.crew.name}
					secondaryText={item.success.toFixed(2) + '%'}
					showSecondaryText={true}
					size={PersonaSize.small}
					presence={(item.success >= 99.9) ? PersonaPresence.online : ((item.success > 50) ? PersonaPresence.away : PersonaPresence.busy)} />);
			});
		}

		const numPersonnelColumns = 5;
		return (<div className='mission-challenge'>
			<h4>{challenge.name}</h4>
			<div className='mc-matrix'>
				<div className='mcm-label'>Skill:</div>
				<div className='mcm-value'>
					<Image src={CONFIG.SPRITES['icon_' + challenge.skill].url} height={18} />
					&nbsp;{CONFIG.SKILLS[challenge.skill]}
				</div>
				<div className='mcm-label'>Trait Bonuses:</div>
				<div className='mcm-value'>
					{(traitBonuses.length > 0)
						? traitBonuses.reduce((prev, curr) => prev === undefined ? curr : <>{prev}, {curr}</>)
						: 'None'}
				</div>
				<div className='mcm-label'>Locks:</div>
				<div className='mcm-value'>
					{(lockTraits.length > 0)
						? lockTraits.reduce((prev, curr) => prev === undefined ? curr : <>{prev}, {curr}</>)
						: 'None'}
				</div>
				{critical && (<div className='mcm-label'>Critical Reward:</div>)}
				{critical && (<div className='mcm-value'>{critical}</div>)}
			</div>
			<div
				className='mc-personnel'
				style={{
					gridTemplateColumns: `repeat(${numPersonnelColumns}, 1fr)`,
					gridTemplateRows: `repeat(${Math.ceil(crewSuccess.length / numPersonnelColumns)}, 1fr)`,
				}}>
				{crewSuccess}
			</div>
			{(recommendations === undefined || recommendations.crew.length === 0) &&
				<span className='ui header red'>You have no crew capable of completing this node!</span>
			}
		</div>);
	}

	htmlDecode(input: string) {
		let output = input.replace(/<#([0-9A-F]{6})>/gi, '<span style="color:#$1">');
		output = output.replace(/<\/color>/g, '</span>');

		return { __html: output };
	}

	handleMasteryChange(evt: React.ChangeEvent<HTMLInputElement>): void {
		const index = Number(evt.target.value);
		this.setState({
			masteryIndex: index,
			...calculateQuestRecommendations(this.props.questId?.data.questId, index, false),
		});
	}

	render() {
		if (!this.state.mission) {
			return <span />;
		}

		let crewSelectionLog;
		if (this.state.bestCrewPaths?.length === 0) {
			if (this.state.allFinished) {
				crewSelectionLog = <span className='ui header green'>You already completed all nodes on this mission.<br/>Congrats!</span>;
			} else {
				crewSelectionLog = <span className='ui header red'>There is no crew selection capable of completing the remaining critical mission paths.<br/>Get more crew!</span>;
			}
		}
		else {
			crewSelectionLog = [];
			this.state.bestCrewPaths?.forEach((crewpath, indexcrewpath) => {
				let crewSuccess: JSX.Element[] = [];
				crewpath.crew.forEach((crewpathcrew, index) => {
					crewSuccess.push(<Persona
						key={crewpathcrew.crew.name + index}
						imageUrl={STTApi.imgUrl(crewpathcrew.crew.portrait, undefined)} // should refresh on load when this is converted to a function component
						text={`(${crewpath.path[index]}) ${crewpathcrew.crew.name}${(crewpathcrew.crew.frozen > 0) ? ' - FROZEN' : ''}`}
						size={PersonaSize.extraExtraSmall}
						presence={PersonaPresence.none} />);
				});

				crewSelectionLog.push(
					<div key={indexcrewpath}>
						<div>{(crewpath.success).toFixed(2)}% guaranteed success:</div>
						<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>{crewSuccess}</div>
					</div>
				);
			});
		}

		// determine remaining criticals
		let criticalList: JSX.Element[] = [];
		this.state.mission.mastery_levels[this.state.masteryIndex].jackpots.forEach(jp => {
			if (!jp.claimed) {
				const item = jp.reward[0];
				// TODO: need to load item image
				// most will probably not be in the cache, as they are not owned yet
				// need to take specials (honor, dilithium, schematics, crew) into account
				// let itemUrl;
				// let eq = STTApi.itemArchetypeCache.archetypes
				// 	.find(equipment => equipment.id === item.id);
				// if (eq) {
				// 	itemUrl = eq.iconUrl;
				// }
				let multipleCount;
				if (item.quantity > 1) {
					multipleCount = (<span>(x {item.quantity})</span>);
				}

				criticalList.push(
					(<div key={item.id}>
						<span>(#{jp.id}) - </span>
						{/* <ItemDisplay
							style={{ display: 'inline-block' }}
							src={itemUrl ? itemUrl : ''}
							size={32}
							maxRarity={item.rarity}
							rarity={item.rarity}
						/>{' '} */}
						{item.full_name}
						<RarityStars asSpan={true} max={item.rarity} value={item.rarity} />
						{multipleCount}
					</div>)
				);
			}
		});
		if (criticalList.length === 0) {
			criticalList.push((<div key='none'>None</div>));
		}

		const selectedThemeColor = getTheme().palette.tealLight;
		const normalWidth = this.state.masteryIndex === 0 ? '2px' : '0';
		const eliteWidth = this.state.masteryIndex === 1 ? '2px' : '0';
		const epicWidth = this.state.masteryIndex === 2 ? '2px' : '0';
		return (
			<div className='mission-info'>
				<div className='mission-details'>
					<h3>{this.state.mission.name}</h3>
					<p>{this.state.mission.description}</p>
					<div className='mission-matrix'>
						<div></div>
						<div className='mm-header'>
							<label htmlFor='ms-normal'>
								<Image src={CONFIG.MASTERY_LEVELS[0].url()} height={24} />
							</label>
						</div>
						<div className='mm-header'>
							<label htmlFor='ms-elite'>
								<Image src={CONFIG.MASTERY_LEVELS[1].url()} height={24} />
							</label>
						</div>
						<div className='mm-header'>
							<label htmlFor='ms-epic'>
								<Image src={CONFIG.MASTERY_LEVELS[2].url()} height={24} />
							</label>
						</div>
						<div></div>
						<div className='mm-header'>
							<input
								type='radio'
								id='ms-normal'
								name='mastery-selection'
								value={0}
								checked={this.state.masteryIndex === 0}
								onChange={this.handleMasteryChange}
							/>
						</div>
						<div className='mm-header'>
							<input
								type='radio'
								id='ms-elite'
								name='mastery-selection'
								value={1}
								checked={this.state.masteryIndex === 1}
								onChange={this.handleMasteryChange}
							/>
						</div>
						<div className='mm-header'>
							<input
								type='radio'
								id='ms-epic'
								name='mastery-selection'
								value={2}
								checked={this.state.masteryIndex === 2}
								onChange={this.handleMasteryChange}
							/></div>
						<div className='mm-label'>Mastery Required:</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderTopWidth: normalWidth,
							borderLeftWidth: normalWidth,
							borderRightWidth: normalWidth}}>
								{(this.state.mission.difficulty_by_mastery)
								&& this.state.mission.difficulty_by_mastery[0]}
						</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderTopWidth: eliteWidth,
							borderLeftWidth: eliteWidth,
							borderRightWidth: eliteWidth}}>
								{(this.state.mission.difficulty_by_mastery)
								&& this.state.mission.difficulty_by_mastery[1]}
						</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderTopWidth: epicWidth,
							borderLeftWidth: epicWidth,
							borderRightWidth: epicWidth}}>
								{(this.state.mission.difficulty_by_mastery)
								&& this.state.mission.difficulty_by_mastery[2]}
						</div>
						<div className='mm-label'>Trait Bonuses:</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderLeftWidth: normalWidth,
							borderRightWidth: normalWidth}}>
								{(this.state.mission.trait_bonuses)
								&& this.state.mission.trait_bonuses[0]}
						</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderLeftWidth: eliteWidth,
							borderRightWidth: eliteWidth}}>
								{(this.state.mission.trait_bonuses)
								&& this.state.mission.trait_bonuses[1]}
						</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderLeftWidth: epicWidth,
							borderRightWidth: epicWidth}}>
								{(this.state.mission.trait_bonuses)
								&& this.state.mission.trait_bonuses[2]}
						</div>
						<div className='mm-label'>Completed:</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderBottomWidth: normalWidth,
							borderLeftWidth: normalWidth,
							borderRightWidth: normalWidth}}>
								{this.state.mission.mastery_levels[0].progress.goal_progress} of {this.state.mission.mastery_levels[0].progress.goals}
						</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderBottomWidth: eliteWidth,
							borderLeftWidth: eliteWidth,
							borderRightWidth: eliteWidth}}>
								{this.state.mission.mastery_levels[1].progress.goal_progress} of {this.state.mission.mastery_levels[1].progress.goals}
						</div>
						<div className='mm-data' style={{
							border: `0 solid ${selectedThemeColor}`,
							borderBottomWidth: epicWidth,
							borderLeftWidth: epicWidth,
							borderRightWidth: epicWidth}}>
								{this.state.mission.mastery_levels[2].progress.goal_progress} of {this.state.mission.mastery_levels[2].progress.goals}
						</div>
						<div className='mm-divider'><hr/></div>
						<div className='mm-label'>Critical Threshold:</div>
						<div className='mm-note'>{this.state.mission.critical_threshold ? this.state.mission.critical_threshold : 'none'}</div>
						{this.state.mission.cadet && (<div className='mm-label'>Cadet Requirements:</div>)}
						{this.state.mission.cadet && (<div className='mm-note'>
							<span dangerouslySetInnerHTML={this.htmlDecode(this.state.mission!.crew_requirement!.description)} />
						</div>)}
						<div className='mm-divider'><hr/></div>
						<div className='mm-label'>Remaining Criticals:</div>
						<div className='mm-note'>{criticalList}</div>
					</div>
				</div>
				<div className='mission-graph'>
					<canvas
						ref={this.canvasRef}
						width={1000}
						height={450}
						style={{ width: '100%', height: 'auto' }}
					/>
					{crewSelectionLog}
				</div>
				<div className='mission-calc'>
					{this.renderChallengeDetails()}
				</div>
			</div>
		);
	}
}
