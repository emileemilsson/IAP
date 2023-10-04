import React from 'react';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import UserStore from './Styles';

import STTApi from '../api';
import { CONFIG, NumberPicker, getChronitonCount } from '../api';
import { MissionQuestDTO, MissionQuestMasteryLevelDTO } from '../api/DTO21';

export const WarpDialog = (props:{
	questId?: number;
	masteryLevel?: number;
	onWarped?: () => void;
	onClose?: () => void;
}) => {
	const [showDialog, setShowDialog] = React.useState(false);
	const [warpCount, setWarpCount] = React.useState(1);
	const [quest, setQuest] = React.useState(undefined as MissionQuestDTO | undefined);
	const [mastery, setMastery] = React.useState(undefined as MissionQuestMasteryLevelDTO | undefined);
	const [masteryLevel, setMasteryLevel] = React.useState(undefined as number | undefined);
	const [, imageCacheUpdated] = React.useState<string>('');

	React.useEffect(() => {
		show();
	}, [props.questId, props.masteryLevel]);

	function show(): void {
		if (!props.questId || props.masteryLevel === undefined) {
			return;
		}
		for (let mission of STTApi.missions) {
			let quest = mission.quests.find(q => q.id === props.questId);
			if (quest) {
				let mastery = quest.mastery_levels[props.masteryLevel];
				setShowDialog(true);
				setQuest(quest);
				setMastery(mastery);
				setMasteryLevel(props.masteryLevel);

				break;
			}
		}
	};

	const closeDialog = () => {
		setShowDialog(false);
		setQuest(undefined);
		setMastery(undefined);
		setMasteryLevel(undefined);
		setWarpCount(1);
		if (props.onClose) {
			props.onClose();
		}
	}

	const warp = async (warpCount: number) => {
		let warpTimes = (STTApi.playerData.vip_level > 3) ? 10 : 1;
		while (warpCount > warpTimes) {
			let ephemerals = await STTApi.warpQuest(quest!.id, masteryLevel!, warpTimes);
			// TODO: show rewards to the user somehow
			console.log(ephemerals);

			warpCount -= warpTimes;
		}

		if (warpCount > 0) {
			let ephemerals = await STTApi.warpQuest(quest!.id, masteryLevel!, warpCount);
			// TODO: show rewards to the user somehow
			console.log(ephemerals);
		}

		closeDialog();

		if (props.onWarped) {
			props.onWarped();
		}
	}

	if (!showDialog || !quest) {
		return <span />;
	}

	let chronAvailable = getChronitonCount();
	let cost = mastery!.energy_cost;
	if (STTApi.playerData.character.stimpack) {
		cost *= 1 - (STTApi.playerData.character.stimpack.energy_discount / 100);
		cost = Math.ceil(cost);
	}
	let chronNeeded = cost * warpCount;

	let currentTheme = UserStore.get('theme');

	return <Dialog
		hidden={!showDialog}
		onDismiss={closeDialog}
		dialogContentProps={{
			type: DialogType.normal,
			title: `Warp mission '${quest.name}' on ${CONFIG.MASTERY_LEVELS[masteryLevel!].name}`
		}}
		modalProps={{
			containerClassName: 'warpdialogMainOverride',
			isBlocking: true
		}}
	>
		<div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gridTemplateAreas: `'image description' 'image chronitons' 'image warpcount'`, color: currentTheme.semanticColors.bodyText, backgroundColor: currentTheme.semanticColors.bodyBackground }}>
			<div style={{ gridArea: 'image' }}><img src={STTApi.imgUrl({file: quest?.timeline_icon?.file}, imageCacheUpdated)} width={200} height={200} style={{ objectFit: 'contain' }} /></div>
			<div style={{ gridArea: 'description' }}>
				<p>{quest.description}</p>
				{mastery!.locked && <p>This mission is locked; you can't warp it until you complete this mastery level in the game</p>}
				<p><b>NOTE:</b> This feature is experimental; let me know how it worked for you.</p>
			</div>
			<div style={{ gridArea: 'chronitons' }}>
				<p>Chronitons needed: {chronNeeded} / {chronAvailable}</p>
			</div>
			<div style={{ gridArea: 'warpcount' }}>
				<NumberPicker value={warpCount} compact label={'Warp count:'} min={1} max={100} step={1} onChange={({ value }) => { setWarpCount(value); }} />
			</div>
		</div>

		<DialogFooter>
			<PrimaryButton onClick={() => warp(10)} text='Warp 10' disabled={((cost * 10) > chronAvailable) || mastery!.locked} />
			<PrimaryButton onClick={() => warp(warpCount)} text={`Warp ${warpCount}`} disabled={(chronNeeded > chronAvailable) || mastery!.locked} />
			<DefaultButton onClick={() => closeDialog()} text='Cancel' />
		</DialogFooter>
	</Dialog>;
}
