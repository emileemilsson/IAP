import React from 'react';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';

import { CrewShipList } from './CrewShipList';

import STTApi from '../../api';
import { CrewData } from '../../api/DTO21';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

export interface CrewShipPageProps {
    onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

export const CrewShipPage = (props: CrewShipPageProps) => {
    const [filterText, setFilterText] = React.useState('');
    const [crewData, setCrewData] = React.useState(loadCrewData());

    function loadCrewData() : CrewData[] {
        let crewData = STTApi.roster;
        crewData = crewData.filter(crew => !crew.buyback);

        return crewData;
    }

    return <div>
        <SearchBox placeholder='Search by name or trait...'
            onChange={(ev, newValue) => setFilterText(newValue || '')}
            onSearch={(newValue) => setFilterText(newValue)}
        />
        <CrewShipList data={crewData}
            filterText={filterText} />
    </div>;
}
