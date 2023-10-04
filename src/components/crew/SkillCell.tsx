import React from 'react';
import { SkillData, CrewDTO, CrewData } from '../../api/DTO21';
import { RarityStars, CONFIG } from '../../api';

/**
 * Shows a <div> of <span>s with optional voy/combined or core, optional proficiency.
 * Suited for use in table cells.
 */
export const SkillCell = (props: {
	skill: SkillData;
	combined?: boolean;
	proficiency?: boolean;
	compactMode?: boolean;
}) => {
	if (props.skill.core > 0) {
		let out = <span className='skill-stats'>{props.skill.core}</span>;
		let range = <span className='skill-stats-range'>+({props.skill.min} - {props.skill.max})</span>;
		if (props.combined) {
			out = <span className='skill-stats'>{props.skill.voy}</span>;
		}
		if (props.proficiency) {
			out = range;
		}
		if (props.compactMode) {
			return <div className='skill-stats-div'>{out}</div>;
		} else {
			return <div className='skill-stats-div'>{out}</div>;
		}
	}
	else {
		return <div className='skill-stats-div'></div>;
	}
}

/**
 * Show all nonzero crew skills by icon or text
 */
export const CrewSkills = (props: {
	crew: CrewData;
	/** Use icon or text for skill types */
	useIcon?: boolean;
	/** Hide proficiencies */
	hideProf?: boolean;
	/** Show skill numbers as voyage score computed values, otherwise as base + prof */
	asVoyScore?: boolean;
	/** Add voyage total to the record */
	addVoyTotal?: boolean;
	/** If exists, an additional value added at the end of the record */
	addScore?: number;
	/** If true, line break after rarity stars, otherwise a space */
	starBreakSpace?: boolean;
	/** If true (and addVoyTotal is true), line break before voyage score, otherwise a space */
	voyBreakSpace?: boolean;
}) => {
	const crew = props.crew;
	let firstDash = props.starBreakSpace ? true : false;
	return <span key={crew.id}>
		<RarityStars max={crew.max_rarity} value={crew.rarity} asSpan={true} colored={true} />{
			props.starBreakSpace ? <br/> : <>&nbsp;</>
		}
		{ Object.keys(CONFIG.SKILLS).map(s => {
			// Don't show zero skill values
			if (!crew.skills[s] || (crew.skills[s].core <= 0 && crew.skills[s].min <= 0)) {
				return <span key={s} />;
			}
			// BorrowedCrewDTO and CrewDTO will have missing skills or unknown voy skills
			if (props.asVoyScore && (crew.skills[s].voy === undefined || crew.skills[s].voy <= 0)) {
				return <span key={s} />;
			}
			let wasFirstDash = firstDash;
			firstDash = false;
			return <span key={s}>{
				props.useIcon ?
					<img src={CONFIG.SPRITES['icon_' + s].url} height={18} />
					: <span>{wasFirstDash ? '' : ' - '}{CONFIG.SKILLS_SHORT[s]}{' '}</span>
				}
				{
					props.asVoyScore ?
						crew.skills[s].voy :
						(props.hideProf ?
							crew.skills[s].core :
							(crew.skills[s].core + ' (' + crew.skills[s].min + '-'  + crew.skills[s].max + ')'))
				}
				</span>;
		})}
		{
			props.addVoyTotal && <span key='v'>{props.voyBreakSpace ? <br/> : ' - '}
				Voy {Object.keys(CONFIG.SKILLS).map(s => crew.skills[s].voy).reduce((acc,c) => acc + c, 0)}
			</span>
		}
		{
			props.addScore !== undefined && <span key='s'>{' - '}{props.addScore}</span>
		}
	</span>;
}
