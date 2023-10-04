import * as React from 'react';

import STTApi from '../api';
import { CONFIG } from '../api';

interface SuccessProps {
    title: string;
    cadet: boolean;
}

export class GuaranteedSuccess extends React.Component<SuccessProps> {
    render() {
        let missions = STTApi.missionSuccess.filter(m => !m.completed);
        return <div>
            <h2>{this.props.title}</h2>
            {missions.map((recommendation) => {
                if (recommendation.cadet !== this.props.cadet) {
                    return <span key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name} />;
                }

                if (recommendation.crew.length === 0) {
                    return <div key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}>
                        <h3>{recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}</h3>
                        <span style={{ color: 'red' }}>No crew can complete this challenge!</span><br />
                        <span className='quest-mastery'>You need a crew with the <img src={CONFIG.SPRITES['icon_' + recommendation.skill].url} height={18} /> {CONFIG.SKILLS[recommendation.skill]} skill of at least {recommendation.roll}
                            {(recommendation.lockedTraits.length > 0) &&
                                (<span>&nbsp;and one of these traits: {recommendation.lockedTraits
                                    .map((trait) => STTApi.getTraitName(trait)).join(', ')}
                                </span>)}.</span>
                    </div>;
                }

                if (recommendation.crew.filter((crew) => crew.success > 99.9).length === 0) {
                    return <div key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}>
                        <h3>{recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}</h3>
                        <span>Your best bet is {recommendation.crew[0].crew.name} with a {recommendation.crew[0].success.toFixed(2)}% success chance.</span><br />
                        <span className='quest-mastery'>You need a crew with the <img src={CONFIG.SPRITES['icon_' + recommendation.skill].url} height={18} /> {CONFIG.SKILLS[recommendation.skill]} skill of at least {recommendation.roll}
                            {(recommendation.lockedTraits.length > 0) &&
                                (<span>&nbsp;and one of these traits: {recommendation.lockedTraits.map((trait) => STTApi.getTraitName(trait)).join(', ')}
                                </span>)}.</span>
                    </div>;
                }
            })
            }
        </div>;
    }
}

interface IncMissionProps {

}

export class IncompleteMissions extends React.Component<IncMissionProps> {
    constructor(props: IncMissionProps) {
        super(props);
    }

    render() {
        return <div className='tab-panel' data-is-scrollable='true'>
            <GuaranteedSuccess title='Cadet challenges without guaranteed success' cadet={true} />
            <br/>
            <GuaranteedSuccess title='Missions without guaranteed success' cadet={false} />
        </div>;
    }
}
