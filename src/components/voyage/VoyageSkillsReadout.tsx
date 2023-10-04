import React from 'react';

import { CONFIG } from '../../api';

import { GetSpriteCssClass } from '../DarkThemeContext';

export type Skill = {
    skill: string;
    core: number;
    range_min: number;
    range_max: number;
};

export const VoyageSkillsReadout = (props: {
    skill_aggregates: { [sk: string]: Skill };
    success_readout: (sk: Skill) => JSX.Element;
    failure_readout: (sk: Skill) => JSX.Element;
}) => {
    const spriteClass = GetSpriteCssClass();
    return (
        <div className='vc-skills'>
            <div className='ui label big group-header'>Skill Aggregates</div>
            {
                Object.keys(props.skill_aggregates).map(k => props.skill_aggregates[k]).map(skill => {
                    return (
                        <div className='vc-skill' key={skill.skill}>
                            <div className='vcs-icon'>
                                <img
                                    className={`image-fit ${spriteClass}`}
                                    src={CONFIG.SPRITES['icon_' + skill.skill].url}
                                />
                            </div>
                            <div className='vcs-range'>
                                Core: {skill.core}
                                <br/>
                                Range: {skill.range_min}-{skill.range_max}
                                <br/>
                                Average: {skill.core + (skill.range_min + skill.range_max) / 2}
                            </div>
                            <div className='vcs-success'>
                                {props.success_readout(skill)}
                            </div>
                            <div className='vcs-failure'>
                                {props.failure_readout(skill)}
                            </div>
                        </div>
                    );
                })
            }
        </div>
    );
};