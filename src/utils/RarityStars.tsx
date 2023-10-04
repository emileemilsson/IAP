import React from 'react';
import CONFIG from '../api/CONFIG';

export interface RarityStarsProps {
	value?: number;
	max: number;
	asSpan?: boolean;
	colored?: boolean;

	/** @deprecated don't actually need a min, it is always 1 */
	min?: number;
}

export let RarityStars = (props: RarityStarsProps) => {
	let stars = "☆";
	if (props.value !== undefined) {
		stars = "★".repeat(props.value);
		stars = stars + "☆".repeat(props.max - props.value);
	}

	let inner = () => {
		if (props.asSpan) {
			return (<span className='rarity-stars'>{stars}</span>);
		}
		return (<div className='rarity-stars'>{stars}</div>);
	}

	let color = props.max || props.value;

	if (props.colored && color) {
		if (props.asSpan) {
			return <span style={{ color: CONFIG.RARITIES[color].color}}>{inner()}</span>;
		}
		return <div style={{ color: CONFIG.RARITIES[color].color }}>{inner()}</div>;
	}
	return inner();
}
