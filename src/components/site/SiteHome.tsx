import React from 'react';
import { Container, Menu, Loader, Icon, MenuItemProps } from 'semantic-ui-react';

import { CrewPage } from './CrewPage';
import { SiteHomePage } from './SiteHomePage';

import STTTools from './STTTools';

export const SiteHome = (props: {
    onAccessToken: () => void;
}) => {
    const [loading, setLoading] = React.useState<boolean>(false);
    const [activeItem, setActiveItem] = React.useState<string>('home');
    const [, updateState] = React.useState();

    // STTTools.initialize().then(() => {
    //     this.setState({ loading: false });
    // });

    if (loading) {
        return <div style={{ display: 'flex', width: '100vw', height: '100vh', justifyContent: 'center', alignItems: 'center' }} >
            <Loader active inline='centered' content='Loading...' />
        </div>;
    }

    const handleItemClick = (e : any, mip : MenuItemProps) => setActiveItem(mip['name'] || 'home');

    return <div>
        <Menu fixed='top' inverted>
            <Container>
                <Menu.Item as='a' header onClick={handleItemClick} name='home' active={activeItem === 'home'}>Home</Menu.Item>
                <Menu.Item as='a' onClick={handleItemClick} name='crewstats' active={activeItem === 'crewstats'}>Crew stats</Menu.Item>
            </Container>
        </Menu>

        <div style={{ marginTop: '3em', padding: '1em' }}>
            {renderItem(activeItem)}
        </div>
    </div>;

    function renderItem(name:string) {
        switch (name) {
            case 'home':
                return <SiteHomePage onAccessToken={props.onAccessToken} />;

            case 'crewstats':
                return <CrewPage />;
        }
    }
}