import React from 'react';

export interface CircularLabelProps {
	percent: number;
}

export const CircularLabel = (props: CircularLabelProps) => {
	// http://stackoverflow.com/a/3943023/112731
	const getLuminance = (c: number[]) => {
		let i, x;
		const a = [];
		for (i = 0; i < c.length; i++) {
			x = c[i] / 255;
			a[i] = x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
		}
		return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
	};

	let backColor;
	if (props.percent < 6) {
		backColor = [parseInt('0xa7'), parseInt('0xbd'), parseInt('0x0d')];
	} else if (props.percent < 26) {
		backColor = [parseInt('0xfb'), parseInt('0xbd'), parseInt('0x08')];
	} else if (props.percent < 46) {
		backColor = [parseInt('0xf2'), parseInt('0x71'), parseInt('0x1c')];
	} else {
		backColor = [parseInt('0xdb'), parseInt('0x28'), parseInt('0x28')];
	}

	let color;
	if (getLuminance(backColor) > Math.sqrt(1.05 * 0.05) - 0.05) {
		color = 'black';
	} else {
		color = 'white';
	}

	const padz = (str: string) => ('00' + str).slice(-2);

	return <div className="ui circular label" style={{
		position: 'absolute', left: '0', bottom: '0',
		backgroundColor: `#${backColor.map(c => padz(c.toString(16))).join('')}`,
		color: color
	}}>
		{props.percent}%
	</div>;
}
