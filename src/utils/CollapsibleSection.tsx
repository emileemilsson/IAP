import React from 'react';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { ColorClassNames } from '@uifabric/styling';

export interface CollapsibleSectionProps {
	background?: string;
	title?: string;
	children?: any;
}

export const CollapsibleSection = (props:CollapsibleSectionProps) => {
	let [isCollapsed, setCollapsed] = React.useState(true);

	let background = props.background ? props.background : 'none';

	return (<div className='collapsible-section'>
		<h2>
			<button
				type='button'
				style={{ background: background, border: 'none', marginRight: '6px' }}
				onClick={() => setCollapsed(!isCollapsed)}
			>
				<Icon
					iconName={isCollapsed ? 'ChevronDown' : 'ChevronUp'}
					className={ColorClassNames.neutralDark}
				/>
			</button>
			{props.title}
		</h2>
		{!isCollapsed && props.children}
	</div>);
}
