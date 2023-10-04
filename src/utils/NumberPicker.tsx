import React from 'react';
import { Button, Input } from 'semantic-ui-react';

export const DECREASE_VALUE = 'DECREASE_VALUE';
export const INCREASE_VALUE = 'INCREASE_VALUE';

// From https://github.com/semantic-ui-react-numberpicker/semantic-ui-react-numberpicker/blob/master/src/index.js

/*
 USAGE EXAMPLES:
 <Form.Field inline control={NumberPicker} name={MULTIPLY_INPUT + ".times"} onChange={this.triggerChange} label="Copies to create" defaultValue={1} min={1} max={999} placeholder="Repeat ..." />
 <Form.Field width="8" control={NumberPicker} compact label="compact buttons" placeholder="Enter a number" defaultValue={6} min={-41} max={45} step={1} />
 <Form.Field width="8" control={NumberPicker} circular label="circular buttons" placeholder="Enter a number" defaultValue={6} min={-41} max={45} step={1} />
 <Form.Field width="8" control={NumberPicker} basic label="basic buttons" placeholder="Enter a number" defaultValue={4} min={-40} max={40} step={2} />

*/

export interface NumberPickerProps {
	// placeholder: 'Enter a number',
	// id: '',
	// min: 1e10 * -1,
	// max: 1e10,
	// maxLength: 10,
	// step: 1,
	// required: false,
	// basic: false,
	// circular: false,
	// compact: false,
	// classname_button_minus: 'number_picker_button_minus',
	// classname_button_plus: 'number_picker_button_plus',
	// classname_outer_input: 'number_picker',
	// classname_inner_input: 'number_picker_input'

	value: number;
	step: number;
	min: number;
	max: number;
	onChange: (obj: {name: string, value: number}) => void;
	name?: string;
	circular?: boolean;
	basic?: boolean;
	compact: boolean;
	placeholder?: string;
	label?: string;
	required?: boolean;
	maxLength?: number;
	id?: string;
	defaultValue?: string;
	classname_button_minus?: string;
	classname_button_plus?: string;
	classname_outer_input?: string;
	classname_inner_input?: string;
}

export const NumberPicker = (props:NumberPickerProps) => {
	let styleDefault = {
		default: {
			input: {
				borderRadius: '0px',
				textAlign: 'right'
			},
			buttonLeft: {
				borderTopRightRadius: '0px',
				borderBottomRightRadius: '0px',
				margin: '0px'
			},
			buttonRight: {
				borderTopLeftRadius: '0px',
				borderBottomLeftRadius: '0px'
			}
		},
		circular: {
			input: {
				textAlign: 'right'
			},
			buttonLeft: {
				marginRight: '3.5px'
			},
			buttonRight: {
				marginLeft: '3.5px'
			}
		}
	};

	// let handleAction = this.handleAction.bind(this);
	// let validateInput = this.validateInput.bind(this);

	// this.state = {
	// 	touched: false,
	// 	buffer: {}
	// };

	// static get defaultProps() {
	// 	return {
	// 		placeholder: 'Enter a number',
	// 		id: '',
	// 		/*
   //           Limiting min, max value to 1e10 to prevent javascript to switch into scientific notation
   //           */
	// 		min: 1e10 * -1,
	// 		max: 1e10,
	// 		maxLength: 10,
	// 		step: 1,
	// 		required: false,
	// 		basic: false,
	// 		circular: false,
	// 		compact: false,
	// 		classname_button_minus: 'number_picker_button_minus',
	// 		classname_button_plus: 'number_picker_button_plus',
	// 		classname_outer_input: 'number_picker',
	// 		classname_inner_input: 'number_picker_input'
	// 	};
	// }

	const handleAction = (event:any) => {
		let actionFilter = event.currentTarget.name;
		let currentValue = event.currentTarget.value.replace(',', '.').replace(/\D/g, '');

		let setVal = isFinite(props.value) ? props.value : 0;
		let stepSize = isFinite(props.step) ? props.step : 1;
		switch (actionFilter) {
			case DECREASE_VALUE:
				if (props.value - stepSize >= props.min) setVal -= stepSize;
				else setVal = props.min;

				break;
			case INCREASE_VALUE:
				if (setVal + stepSize <= props.max) setVal += stepSize;
				else setVal = props.max;

				break;
			default:
				let parsedVal = parseFloat(currentValue);
				//if (currentValue === '-') this.state.buffer = '-';

				if (!(parsedVal > props.max || parsedVal < props.min)) {
					setVal = currentValue;
				}

				break;
		}

		let setValStr = '' + setVal;
		let lastChar = setValStr.charAt(setValStr.length - 1) || '';
		let returnValue = setVal;
		let precision = 1000;
		if (isFinite(parseFloat(setValStr))) {
			returnValue = Math.floor(parseFloat(setValStr) * precision) / precision;
		}

		if (setValStr === '' || setValStr === '-' || lastChar === '.' || lastChar === ',') {
			returnValue = setVal;
		}

		setTimeout(props.onChange, 1, {
			name: props.name,
			value: returnValue
		});
	}

	const validateInput = (event:any) => {
		let actionFilter = event.target.name;
		let currentValue = event.target.value;

		let setVal : number | undefined = props.value;
		switch (actionFilter) {
			case props.name:
				let parsedVal = parseFloat(currentValue);
				setVal = isFinite(parsedVal) ? parsedVal : undefined;

				if (parsedVal > props.max) setVal = props.max;
				break;

			case DECREASE_VALUE:
			case INCREASE_VALUE:
			default:
				break;
		}
	}

	let style: any = props.circular ? styleDefault.circular : styleDefault.default;
	let display = {
		circular: props.circular,
		basic: props.basic,
		compact: props.compact
	};
	return (
		<Input className={props.classname_outer_input}>
			<Button
				{...display}
				type='button'
				icon='minus'
				onClick={handleAction}
				name={DECREASE_VALUE}
				style={style.buttonLeft}
				disabled={props.value <= props.min}
				className={props.classname_button_minus}
			/>{' '}
			<input
				type='text'
				name={props.name}
				id={props.id}
				min={props.min}
				max={props.max}
				step={props.step}
				className={props.classname_inner_input}
				maxLength={props.maxLength}
				placeholder={props.placeholder}
				required={props.required}
				defaultValue={props.defaultValue}
				value={props.value}
				onChange={handleAction}
				onBlur={validateInput}
				style={style.input}
			/>{' '}
			<Button
				{...display}
				type='button'
				icon='plus'
				onClick={handleAction}
				name={INCREASE_VALUE}
				style={style.buttonRight}
				disabled={props.value >= props.max}
				className={props.classname_button_plus}
			/>{' '}
		</Input>
	);
}
