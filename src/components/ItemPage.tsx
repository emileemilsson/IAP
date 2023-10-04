import React from 'react';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { exportItemsCsv } from './crew/csvExporter';
import { download } from '../utils/pal';
import STTApi from '../api';
import { ItemList } from './ItemList';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

export const ItemPage = (props: {
    onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}) => {
    const [filterText, setFilterText] = React.useState('');
    const [onlyShip, setOnlyShip] = React.useState<boolean>(false);

    React.useEffect(() => updateCommandItems(), []);
    React.useEffect(() => updateCommandItems(), [onlyShip]);

    let items = STTApi.items;
    if (onlyShip) {
        items = items.filter(it => it.sources.some(src => src.type === 'ship'));
    }

    return <div>
        <SearchBox placeholder='Search by name or description...'
            onChange={(ev, newValue) => setFilterText(newValue ?? '')}
            onSearch={(newValue) => setFilterText(newValue)}
        />
        <ItemList data={items} filterText={filterText} />
    </div>;

    function updateCommandItems() {
        if (props.onCommandItemsUpdate) {
            props.onCommandItemsUpdate([
                {
                    key: 'exportCsv',
                    name: 'Export CSV...',
                    iconProps: { iconName: 'ExcelDocument' },
                    onClick: () => {
                        let csv = exportItemsCsv();
                        download('My Items.csv', csv, 'Export Star Trek Timelines item inventory', 'Export');
                    }
                },
                {
                    key: 'settings',
                    text: 'Settings',
                    iconProps: { iconName: 'Equalizer' },
                    subMenuProps: {
                        items: [{
                            key: 'onlyShip',
                            text: 'Ship Battle Rewards',
                            canCheck: true,
                            isChecked: onlyShip,
                            onClick: () => {
                                let isChecked = !onlyShip;
                                setOnlyShip(isChecked);
                            }
                        }]
                    }
                }
            ]);
        }
    }
}
