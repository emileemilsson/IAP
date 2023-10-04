import React from 'react';
import ReactTable, { SortingRule, Column } from 'react-table';

import { RarityStars } from '../utils/RarityStars';

import STTApi from '../api';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { ShipDTO, ShipSchematicDTO } from '../api/DTO21';

export const ShipList = () => {
	const [sorted, setSorted] = React.useState([{ id: 'name', desc: false },{id: 'sort_level', desc:false}] as SortingRule[]);
	const [filterText, setFilterText] = React.useState<string>('');
	const [, imageCacheUpdated] = React.useState<string>('');

	let playerSchematics = STTApi.items.filter(item => item.type === 8);

	interface ShipObj {
		ship: ShipDTO;
		schematic?: ShipSchematicDTO;
		sort_level: number;
		schematic_count: number;
	}

	let items: ShipObj[] = STTApi.ships.map(ship => {
		const schematic = STTApi.shipSchematics.find(schematic => schematic.ship.archetype_id === ship.archetype_id);
		const playerSchematic = playerSchematics.find(playerSchematic => playerSchematic.archetype_id === ship.schematic_id);
		let schematic_count = playerSchematic ? playerSchematic.quantity : 0;

		let lev = ship.id > 0 ? (ship.level + 1) / (ship.max_level + 1) : 0;
		let sc = schematic_count;
		if (ship.level < ship.max_level)
			sc = schematic_count / ship.schematic_gain_cost_next_level;
		if (ship.id == 0)
			sc = schematic_count / (schematic ? schematic.cost : 1);
		let sort_level = lev * 100 + sc;
		return {
			ship,
			schematic,
			sort_level,
			schematic_count
		};
	});

	if (filterText) {
		items = items.filter(i => filterShips(i, filterText!.toLowerCase()))
	}

	let columns = getColumns();

	function filterShips(obj: ShipObj, searchString: string) {
		return searchString.split(';').some(segment => {
			if (segment.trim().length == 0) return false;
			return segment.split(' ').every(text => {
				if (text.trim().length == 0) return false;
				// search the name first
				if (obj.ship.name.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the traits
				if (obj.ship.traits.join(',').toLowerCase().indexOf(text) > -1) {
					return true;
				}

				return false;
			});
		});
	}

	function getColumns() : Column<ShipObj>[] {
		return [
		{
			id: 'icon',
			Header: '',
			minWidth: 60,
			maxWidth: 60,
			accessor: (obj) => obj.ship.name,
			Cell: (p) => <img src={STTApi.imgUrl((p.original as ShipObj).ship.icon, imageCacheUpdated)} width={48} height={48} style={{ objectFit: 'contain' }} />
		},
		{
			id: 'name',
			Header: 'Name',
			minWidth: 140,
			maxWidth: 180,
			resizable: true,
			accessor: (obj) => obj.ship.name,
		},
		{
			id: 'level',
			Header: 'Level',
			accessor: (obj) => obj.sort_level,
			minWidth: 145,
			maxWidth: 145,
			resizable: true,
			Cell: (p: any) => <RarityStars min={1} max={p.original.ship.max_level + 1} value={p.original.ship.id > 0 ? p.original.ship.level + 1 : null} />,
		},
		{
			id: 'rarity',
			Header: 'Rarity',
			minWidth: 75,
			maxWidth: 75,
			resizable: true,
			accessor: (obj) => obj.ship.rarity,
			Cell: (p: any) => <RarityStars min={1} max={p.original.ship.rarity} value={p.original.ship.rarity} />,
		},
		{
			id: 'schematics',
			Header: 'Schematics',
			minWidth: 50,
			maxWidth: 80,
			resizable: true,
			accessor: (obj) => obj.schematic_count,
		},
		{
			id: 'shields',
			Header: 'Shields',
			minWidth: 50,
			maxWidth: 60,
			resizable: true,
			accessor: (obj) => obj.ship.shields
		},
		{
			id: 'hull',
			Header: 'Hull',
			minWidth: 50,
			maxWidth: 60,
			resizable: true,
			accessor: (obj) => obj.ship.hull
		},
		{
			id: 'attack',
			Header: 'Attack',
			minWidth: 70,
			maxWidth: 90,
			resizable: true,
			accessor: (obj) => obj.ship.attack,
			Cell: (p: any) => (
				<span>
					{p.original.ship.attack} ({p.original.ship.attacks_per_second}/s)
				</span>
			)
		},
		{
			id: 'accuracy',
			Header: 'Accuracy',
			minWidth: 50,
			maxWidth: 70,
			resizable: true,
			accessor: (obj) => obj.ship.accuracy
		},
		{
			id: 'evasion',
			Header: 'Evasion',
			minWidth: 50,
			maxWidth: 70,
			resizable: true,
			accessor: (obj) => obj.ship.evasion
		},
		{
			id: 'antimatter',
			Header: 'Antimatter',
			minWidth: 50,
			maxWidth: 70,
			resizable: true,
			accessor: (obj) => obj.ship.antimatter
		},
		{
			id: 'traitNames',
			Header: 'Traits',
			minWidth: 80,
			maxWidth: 250,
			resizable: true,
			accessor: (obj) => obj.ship.traitNames
		},
		{
			id: 'flavor',
			Header: 'Description',
			minWidth: 100,
			resizable: true,
			accessor: (obj) => obj.ship.flavor
		}
		]
	};

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<SearchBox placeholder='Search by name or trait...'
				onChange={(ev, newValue) => setFilterText(newValue ?? '')}
				onSearch={(newValue) => setFilterText(newValue)}
			/>
			<ReactTable
				data={items}
				columns={columns}
				defaultPageSize={items.length <= 50 ? items.length : 50}
				pageSize={items.length <= 50 ? items.length : 50}
				sorted={sorted}
				onSortedChange={s => setSorted(s)}
				showPagination={items.length > 50}
				showPageSizeOptions={false}
				className='-striped -highlight'
				style={(items.length > 50) ? { height: 'calc(100vh - 94px)' } : {}}
			/>
		</div>
	);
}
