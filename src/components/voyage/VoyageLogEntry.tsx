import React from "react";
import STTApi, { CONFIG } from "../../api";
import { Image, Icon } from 'semantic-ui-react';
import { VoyageNarrativeDTO } from "../../api/DTO21";

export const VoyageLogEntry = (props: {
	spriteClass: string;
	log: VoyageNarrativeDTO[];
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');

	return <div className='voyage-log'>
		{
			props.log.map((entry, index) => {
				const isLastEntryOfHazard = (entry.skill_check && (index + 1) === props.log.length);
				let textClass = 'vle-text';
				if (isLastEntryOfHazard) {
					textClass = `${textClass} ui header ${entry.skill_check!.passed ? 'green' : 'red'}`
				}

				return <div className='voyage-log-entry' key={index}>
					<div className='vle-images'>
						{ entry.crew && entry.crew.map(csym => {
								const rc = STTApi.roster.find(rosterCrew => rosterCrew.symbol === csym);
								return STTApi.imgUrl(rc?.portrait, imageCacheUpdated);
							})
							.map((src, j) => <Image avatar className='mini' src={src} key={`${index}-${j}`} />)
						}
						{ isLastEntryOfHazard && <span key={`skill-${index}`}>
								<img className={props.spriteClass} src={CONFIG.SPRITES['icon_' + entry.skill_check!.skill].url} height={32} />
								&nbsp;
								{entry.skill_check!.passed == true ? <Icon name='thumbs up' /> : <Icon name='thumbs down' />}
							</span>
						}
					</div>
					<div className={textClass}>
						<span dangerouslySetInnerHTML={{ __html: entry.text }} />
					</div>
				</div>;
			})
		}
	</div>;
}
