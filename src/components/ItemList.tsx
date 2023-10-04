import React from 'react';
import ReactTable, { SortingRule, Column } from 'react-table';

import { ItemDisplay } from '../utils/ItemDisplay';
import { RarityStars } from '../utils/RarityStars';
import STTApi, { CONFIG, getItemDetailsLink } from '../api';
import { ItemData, ItemArchetypeDTO, ItemDataSource } from '../api/DTO';
import { ReplicatorDialog } from './replicator/ReplicatorDialog';
import { HoverCard } from 'office-ui-fabric-react/lib/HoverCard';

export const ItemList = (props: {
	data: ItemData[];
	filterText?: string;

}) => {
	const [sorted, setSorted] = React.useState<SortingRule[]>([{ id: 'name', desc: false }, { id: 'rarity', desc: false }]);
	const [replicatorTarget, setReplicatorTarget] = React.useState<ItemArchetypeDTO | undefined>(undefined);
	const [, imageCacheUpdated] = React.useState<string>('');

	let items = props.data;

	const columns = getColumns();

	if (props.filterText) {
		items = items.filter(i => filterItem(i, props.filterText!.toLowerCase()))
	}

	const MAX_PAGE_SIZE = 30;

	return (
		<div className='data-grid' data-is-scrollable='true'>
			<ReactTable
				data={items}
				columns={columns}
				defaultPageSize={items.length <= MAX_PAGE_SIZE ? items.length : MAX_PAGE_SIZE}
				pageSize={items.length <= MAX_PAGE_SIZE ? items.length : MAX_PAGE_SIZE}
				sorted={sorted}
				onSortedChange={setSorted}
				showPagination={items.length > MAX_PAGE_SIZE}
				showPageSizeOptions={false}
				className='-striped -highlight'
				style={items.length > MAX_PAGE_SIZE ? { height: 'calc(100vh - 92px)' } : {}}
			/>

			<ReplicatorDialog targetArchetype={replicatorTarget}
				onReplicate={() => setReplicatorTarget(undefined)}
				onClose={() => setReplicatorTarget(undefined)} />
		</div>
	);

	function filterItem(item: ItemData, searchString: string): boolean {
		return searchString.split(';').some(segment => {
			if (segment.trim().length == 0) return false;
			return segment.split(' ').every(text => {
				// search the name first
				if (item.name.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the traits
				if (item.symbol && item.symbol.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the raw traits
				if (item.flavor && item.flavor.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				if (item.icon && item.icon.file && item.icon.file.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				if (item.sources.filter(s => s.title.toLowerCase().indexOf(text) > -1).length > 0) {
					return true;
				}

				return false;
			});
		});
	}

	// filter(newValue: string): void {
	// 	this.setState({
	// 		items: newValue ? this.props.data.filter(i => this._filterItem(i, newValue.toLowerCase())) : this.props.data
	// 	});
	// }

	function onRenderCompactCard(item: ItemData) {
		let fac = item.sources.filter(s => s.type === 'faction');
		let cad = item.sources.filter(s => s.type === 'cadet');
		let sp = item.sources.filter(s => s.type === 'ship').sort((a, b) => b.quotient - a.quotient);
		let dis = item.sources.filter(s => s.type === 'dispute').sort((a, b) => b.quotient - a.quotient);
		const row = (src: ItemDataSource) => <tr key={src.title}><td>{src.type} - {src.title}</td></tr>;

		return <div className="ui items">
			<div className="item">
				<img src={STTApi.imgUrl(item.icon, imageCacheUpdated)} height={40} />
				<div className="content" style={{ padding: '12px', overflow: 'auto' }}>
					<div className="header">{item.name}</div>
					<div className="description">Sources:
					<table><tbody>
							{fac.map(row)}
							{cad.map(row)}
							{sp.map(row)}
							{dis.map(row)}
						</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>;
	}

	function getColumns() : Column<ItemData>[] {
		return [
			{
				id: 'icon',
				Header: '',
				minWidth: 50,
				maxWidth: 50,
				resizable: false,
				accessor: 'name',
				Cell: (cell) => {
					let item = cell.original;
					let found = STTApi.itemArchetypeCache.archetypes.find(arch => arch.id === item.archetype_id);
					if (!found) {
						// For some reason not all items are in the archetype cache, so jam in the needed properties from
						// the existing item
						found = {
							...item,
							id: item.archetype_id
						};
					}
					return <ItemDisplay src={STTApi.imgUrl((item as ItemData).icon, imageCacheUpdated)} size={50} maxRarity={item.rarity} rarity={item.rarity}
						onClick={() => setReplicatorTarget(found)} />;
				}
			},
			{
				id: 'name',
				Header: 'Name',
				minWidth: 130,
				maxWidth: 180,
				resizable: true,
				accessor: 'name',
				Cell: (cell) => {
					let item = cell.original;
					return (
						<a href={getItemDetailsLink(item)} target='_blank'>
							{item.name}
						</a>
					);
				}
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				accessor: 'rarity',
				minWidth: 80,
				maxWidth: 80,
				resizable: false,
				Cell: (cell) => {
					let item = cell.original;
					return <RarityStars min={1} max={item.rarity} value={item.rarity ? item.rarity : null} />;
				}
			},
			{
				id: 'quantity',
				Header: 'Quantity',
				minWidth: 50,
				maxWidth: 80,
				resizable: true,
				accessor: 'quantity'
			},
			{
				id: 'type',
				Header: 'Type',
				minWidth: 70,
				maxWidth: 120,
				resizable: true,
				accessor: 'typeName',
				Cell: (cell) => {
					let item = cell.original;

					let typeName = CONFIG.REWARDS_ITEM_TYPE[item.type];
					if (typeName) {
						return typeName;
					}

					// fall-through case
					typeName = item.icon.file.replace('/items', '').split('/')[1];
					if (typeName) {
						return typeName;
					}

					// show something so we know to fix these
					if (item.item_type) {
						return item.type + '.' + item.item_type;
					}
					return item.type;
				}
			},
			{
				id: 'sources',
				Header: 'Sources',
				minWidth: 50,
				maxWidth: 50,
				resizable: true,
				accessor: 'sources',
				Cell: (cell) => {
					return <HoverCard id="nameHoverCard"
						expandingCardProps={{
							compactCardHeight: 180,
							expandedCardHeight: 420,
							renderData: cell.original,
							//onRenderExpandedCard: _onRenderExpandedCard,
							onRenderCompactCard: onRenderCompactCard,
							styles: { root: { width: '520px' } }
						}}
						instantOpenOnClick={true}>
						<span>{cell.original.sources.length}</span>
					</HoverCard>;
				},
			},
			{
				id: 'image',
				Header: 'Image',
				minWidth: 250,
				maxWidth: 550,
				resizable: true,
				accessor: 'icon.file'
			},
			{
				id: 'details',
				Header: 'Details',
				minWidth: 150,
				maxWidth: 150,
				resizable: true,
				accessor: 'flavor'
			},
			{
				id: 'cadet',
				Header: 'Cadet Details',
				minWidth: 250,
				maxWidth: 450,
				resizable: true,
				accessor: 'cadetable',
				Cell: (p) => {
					let item: ItemData = p.original;
					return item.sources.filter(s => s.type === 'cadet')
						.map((s, i, all) => s.title + (i == all.length - 1 ? '' : ', '));
				}
			},
			{
				id: 'faction',
				Header: 'Faction Details',
				minWidth: 250,
				maxWidth: 450,
				resizable: true,
				accessor: 'factions',
				Cell: (p) => {
					let item: ItemData = p.original;
					return item.sources.filter(s => s.type === 'faction')
						.map((s, i, all) => s.title + (i == all.length - 1 ? '' : ', '));
				}
			}
		];
	}
}
