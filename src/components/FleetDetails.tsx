import React from 'react';
import ReactTable, { Column } from "react-table";
import { Button } from 'semantic-ui-react';
import STTApi, { CollapsibleSection, RarityStars, formatTimeSeconds, download } from '../api';
import { simplejson2csv } from '../utils/simplejson2csv';
import { CrewAvatarDTO } from '../api/DTO';

// #!if ENV === 'electron'
import { loginPubNub } from '../utils/chat';
// #!endif

const MemberList = (props: {
	members: FleetMember[];
	title: string;
}) => {
	if (!STTApi.fleetData) {
		return <span></span>;
	}
	const [sorted, setSorted] = React.useState([{ id: 'display_name', desc: false }]);
	const [, imageCacheUpdated] = React.useState<string>('');
	const members = props.members;
	const columns = getColumns();

	return (<CollapsibleSection title={props.title}>
		<ReactTable
			data={members}
			columns={columns}
			defaultPageSize={50}
			pageSize={50}
			sorted={sorted}
			onSortedChange={sorted => setSorted(sorted)}
			showPagination={false}
			showPageSizeOptions={false}
			className="-striped -highlight"
		/>
		<Button primary onClick={exportCSV} content='Export member list as CSV...' />
	</CollapsibleSection>);

	function exportCSV() {
		let fields = [
			{
				label: 'Name',
				value: (row: any) => row.display_name
			},
			{
				label: 'Rank',
				value: (row: any) => row.rank
			},
			{
				label: 'Squad name',
				value: (row: any) => row.squad_name
			},
			{
				label: 'Squad rank',
				value: (row: any) => row.squad_rank
			},
			{
				label: 'Last active',
				value: (row: any) => row.last_active
			},
			{
				label: 'Event rank',
				value: (row: any) => row.event_rank
			},
			{
				label: 'Level',
				value: (row: any) => row.level
			},
			{
				label: 'Daily activity',
				value: (row: any) => row.daily_activity
			},
			{
				label: 'Location',
				value: (row: any) => row.location
			},
			{
				label: 'Current ship',
				value: (row: any) => row.currentShip
			}];

		let csv = simplejson2csv(members, fields);

		let today = new Date();
		download(STTApi.fleetData!.name + '-' + (today.getUTCMonth() + 1) + '-' + (today.getUTCDate()) + '.csv', csv, 'Export fleet member list', 'Export');
	}

	function getColumns(): Column<FleetMember>[] {
		return [
			{
				id: 'icon',
				Header: '',
				minWidth: 44,
				maxWidth: 44,
				resizable: false,
				accessor: 'display_name',
				Cell: (cell) => <img src={STTApi.imgUrl((cell.original as FleetMember).crew_avatar?.icon, imageCacheUpdated)} width={32} height={32} style={{ objectFit: 'contain' }} />
			},
			{
				id: 'display_name',
				Header: 'Name',
				minWidth: 120,
				maxWidth: 220,
				resizable: true,
				accessor: 'display_name'
			},
			{
				id: 'rank',
				Header: 'Rank',
				minWidth: 50,
				maxWidth: 80,
				resizable: true,
				accessor: 'rank'
			},
			{
				id: 'squad_name',
				Header: 'Squad',
				minWidth: 120,
				maxWidth: 200,
				resizable: true,
				accessor: 'squad_name',
				Cell: (cell) => cell.original.squad_name ? <span>{cell.original.squad_name} ({cell.original.squad_rank})</span> : <span style={{ color: 'red' }}>Not in a squad</span>
			},
			{
				id: 'last_active',
				Header: 'Last active',
				minWidth: 70,
				maxWidth: 100,
				resizable: true,
				accessor: 'last_active',
				Cell: (cell) => <span>{formatTimeSeconds(cell.original.last_active)}</span>
			},
			{
				id: 'daily_activity',
				Header: 'Daily activity',
				minWidth: 50,
				maxWidth: 80,
				resizable: true,
				accessor: 'daily_activity'
			},
			{
				id: 'event_rank',
				Header: 'Event rank',
				minWidth: 50,
				maxWidth: 80,
				resizable: true,
				accessor: 'event_rank'
			},
			{
				id: 'level',
				Header: 'Level',
				minWidth: 50,
				maxWidth: 80,
				resizable: true,
				accessor: 'level'
			},
			{
				id: 'location',
				Header: 'Location',
				minWidth: 60,
				maxWidth: 110,
				resizable: true,
				accessor: 'location'
			},
			{
				id: 'currentShip',
				Header: 'Current Ship',
				minWidth: 70,
				maxWidth: 110,
				resizable: true,
				accessor: 'currentShip'
			}
		];
	}
}

const Starbase = (props: {
	title: string;
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');
	// const [showSpinner, setShowSpinner] = React.useState(false);

	// if (showSpinner) {
	// 	return <div className="centeredVerticalAndHorizontal">
	// 		<div className="ui huge centered text active inline loader">Loading starbase details...</div>
	// 	</div>;
	// }

	const roomContainerStyle = {
		display: 'grid',
		maxWidth: '512px',
		padding: '8px',
		gridTemplateColumns: 'auto auto',
		gridTemplateRows: '24px 24px 24px 24px 24px 136px',
		gridTemplateAreas: `
		"image roomname"
		"image roomstars"
		"image buff1"
		"image buff2"
		"image upgrade"
		"image ."`};


		return (<CollapsibleSection title={props.title}>
		{ STTApi.starbaseRooms.map((room) => {
			let upgrade = room.upgrades[room.level];

			return <div style={roomContainerStyle} key={room.id}>
				<img style={{ position: 'absolute', width: '512px', height: '256px', zIndex: 0, opacity: 0.3 }} src={STTApi.imgUrl(room?.upgrades[room.level]?.buffs[0]?.icon, imageCacheUpdated)} />
				<span style={{ gridArea: 'roomname', justifySelf: 'start', fontSize: '1.5em', fontWeight: 700 }}>{room.name}</span>
				<span style={{ gridArea: 'roomstars', justifySelf: 'start' }}><RarityStars min={1} max={room.max_level} value={(room.level > 0) ? room.level : undefined} /></span>
				<span style={{ gridArea: 'buff1', justifySelf: 'start', fontSize: '1.4em', fontWeight: 600 }}>{upgrade.name}</span>
				<span style={{ gridArea: 'buff2', justifySelf: 'start', fontSize: '1.4em', fontWeight: 600 }}>{(upgrade.buffs && upgrade.buffs.length > 0) ? upgrade.buffs[0].name : ''}</span>
				<span style={{ gridArea: 'upgrade', justifySelf: 'start', fontSize: '1.4em', fontWeight: 600 }}>{
					(room.recommended && room.level !== room.max_level) ? 'Donations recommended' : ''}</span>
				<img style={{ gridArea: 'image', width: '128px', height: '128px', justifySelf: 'center' }} src={STTApi.imgUrl({file:'/' + room.background}, imageCacheUpdated)} />
			</div>;
		})}
	</CollapsibleSection>);
}

interface ChatHistoryMessage {
	from: string;
	text: string;
	timeSent: any;
}

const ChatHistory = (props: {
	title: string;
	chatHistory: ChatHistoryMessage[];
}) => {
	if (!props.chatHistory) {
		return <span/>;
	}

	return <CollapsibleSection title={props.title}>
		{ props.chatHistory.length == 0 && <p>No chat history available</p> }
		{props.chatHistory.map((message, idx) =>
			<p key={idx}><b>{message.from}</b> ({message.timeSent}): {message.text}</p>
		)}
	</CollapsibleSection>;
}

interface FleetMember {
	crew_avatar?: CrewAvatarDTO;
	currentShip: string;
	daily_activity: number;
	dbid: number;
	display_name: string;
	event_rank: number;
	last_active: any;
	level: number;
	location?: string;
	pid: number;
	rank: any;
	squad_rank?: any;
	squad_name?: string;
	squad_event_rank?: any;
}

export const FleetDetails = (props: {}) => {
	const [members, setMembers] = React.useState([] as FleetMember[]);
	const [chatHistory, setChatHistory] = React.useState([] as ChatHistoryMessage[]);
	let [showSpinner, setShowSpinner] = React.useState(true);
	const [,forceUpdate] = React.useState();

	if (!STTApi.playerData.fleet || STTApi.playerData.fleet.id === 0 || !STTApi.fleetData) {
		return <p>It looks like you are not part of a fleet yet!</p>;
	}

	if (!members || members.length === 0) {
		let mems : FleetMember[] = [];
		STTApi.fleetMembers.forEach((member) => {
			var newMember : FleetMember = {
				dbid: member.dbid,
				pid: member.pid,
				level: member.level,
				location: 'unknown',
				currentShip: 'unknown',
				display_name: member.display_name,
				rank: member.rank,
				last_active: member.last_active,
				event_rank: member.event_rank,
				daily_activity: member.daily_activity,
				crew_avatar: member.crew_avatar
			};

			if (member.squad_id)
			{
				newMember.squad_rank = member.squad_rank;
				let squad = STTApi.fleetSquads.find((squad) => ('' + squad.id) == member.squad_id);
				if (squad) {
					newMember.squad_name = squad.name;
					newMember.squad_event_rank = squad.event_rank;
				}
			}

			mems.push(newMember);
		});

		setMembers(mems);
	}

	// let iconPromises : Promise<any>[] = [];
	members.forEach((member) => {
		// // Load player details
		// iconPromises.push(STTApi.inspectPlayer(member.pid).then(memberData => {
		// 	member.level = memberData.character.level;
		// 	member.location = STTApi.playerData.character.navmap.places.find((place) => { return place.symbol == memberData.character.location.place; })!.display_name;
		// 	member.currentShip = memberData.character.current_ship.name;
		// }));
	});
	// Promise.all(iconPromises).then(() => forceUpdate({}));

// #!if ENV === 'electron'
	loginPubNub().then(data => {
		// retrieve recent history of messages
		data.pubnub.history(
			{
				channel: data.subscribedChannels.fleet,
				reverse: false,
				count: 30 // how many items to fetch
			},
			(status:any, response:any) => {
				// handle status, response
				if (response && response.messages) {
					let msgs: ChatHistoryMessage[] = [];
					response.messages.forEach((message:any) => {
						var msg = JSON.parse(decodeURIComponent(message.entry));
						msgs.push({
							from: msg.sourceName.replace(/\+/g, ' '),
							timeSent: new Date(msg.timeSent * 1000).toLocaleString(),
							text: msg.message.replace(/\+/g, ' ')
						});
					});

					setChatHistory(msgs);
				}
			}
		);
		setShowSpinner(false);
	}).catch(err => {
		setShowSpinner(false);
		console.error(err);
	});
// #!else
	showSpinner = false;
// #!endif

	return <div className='tab-panel' data-is-scrollable='true'>
		<h2>{STTApi.fleetData.name}</h2>
		<h3>{STTApi.fleetData.motd}</h3>

		<MemberList title={'Members (' + STTApi.fleetData.cursize + ' / ' + STTApi.fleetData.maxsize + ')'} members={members} />

		<Starbase title='Starbase rooms' />

		<ChatHistory title='Fleet chat recent history' chatHistory={chatHistory} />
		{ showSpinner &&
			<div className="centeredVerticalAndHorizontal">
				<div className="ui huge centered text active inline loader">Loading chat history...</div>
			</div>
		}
	</div>;
}
