import React from 'react';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';
import { Pivot, PivotItem } from 'office-ui-fabric-react/lib/Pivot';
import { Image } from 'office-ui-fabric-react/lib/Image';

import STTApi from '../api';

// #!if ENV === 'electron'
import { ipcRenderer } from 'electron';
// #!endif

export interface LoginDialogProps {
	onAccessToken: () => void;
}

export interface LoginDialogState {
	hideDialog: boolean;
	errorMessage?: string;
	autoLogin: boolean;
	showSpinner: boolean;
	waitingForFacebook: boolean;
	facebookImageUrl: string;
	facebookStatus: string;
	facebookAccessToken?: string;
	facebookUserId?: string;
	username: string;
	password: string;
}

export class LoginDialog extends React.Component<LoginDialogProps, LoginDialogState> {
	constructor(props: LoginDialogProps) {
		super(props);
		this.state = {
			hideDialog: false,
			errorMessage: undefined,
			autoLogin: true,
			showSpinner: false,
			waitingForFacebook: false,
			facebookImageUrl: '',
			facebookStatus: '',
			facebookAccessToken: undefined,
			facebookUserId: undefined,
			username: '',
			password: ''
		};

		this._closeDialog = this._closeDialog.bind(this);

		// #!if ENV === 'electron'
		this._connectFacebook = this._connectFacebook.bind(this);
		// #!endif
	}

	render() {
		return <Dialog
			hidden={this.state.hideDialog}
			onDismiss={this._closeDialog}
			dialogContentProps={{
				type: DialogType.normal,
				title: 'Login to Star Trek Timelines'
			}}
			modalProps={{
				isBlocking: true
			}}
		>
			{this.state.errorMessage && (
				<MessageBar messageBarType={MessageBarType.error} isMultiline={false}>
					<span>{this.state.errorMessage}</span>
				</MessageBar>
			)}

			<Pivot>
				<PivotItem headerText='Username and password'>
					<TextField
						label='Username (e-mail)'
						value={this.state.username}
						onChange={(ev, value) => { this.setState({ username: value ?? ''}) }}
					/>

					<TextField
						label='Password'
						value={this.state.password}
						type='password'
						onChange={(ev, value) => { this.setState({ password: value ?? ''}) }}
					/>
				</PivotItem>
				{/* #!if ENV === 'electron' */}
				<PivotItem headerText='Facebook'>
					<div style={{ marginTop: '5px', alignContent: 'center' }} >
						<PrimaryButton onClick={this._connectFacebook} text='Connect with Facebook' disabled={this.state.waitingForFacebook} />
						<Image src={this.state.facebookImageUrl} height={200} />
						<p>{this.state.facebookStatus}</p>
					</div>
				</PivotItem>
				{/* #!endif */}
			</Pivot>

			<Checkbox
				label='Stay logged in'
				checked={this.state.autoLogin}
				onChange={(ev, checked) => { this.setState({ autoLogin: checked ?? false }); }}
			/>

			<DialogFooter>
				<PrimaryButton onClick={this._closeDialog} text='Login' disabled={this.state.showSpinner} />
				{this.state.showSpinner &&
					<div className="ui medium centered text active inline loader">Logging in...</div>
				}
			</DialogFooter>
		</Dialog>;
	}

	// #!if ENV === 'electron'
	_connectFacebook() {
		this.setState({
			waitingForFacebook: true
		});

		const thisLD = this;

		ipcRenderer.on('fb_access_token', function (event:any, data:any) {
			thisLD.setState({
				waitingForFacebook: false,
				facebookStatus: 'Authenticated with Facebook as ' + data.name + '. Press Login to connect to STT!',
				facebookImageUrl: data.picture.data.url,
				facebookAccessToken: data.access_token,
				facebookUserId: data.id
			});
		}.bind(this));

		ipcRenderer.on('fb_closed', function (event: any, data: any) {
			if (thisLD.state.waitingForFacebook) {
				thisLD.setState({
					waitingForFacebook: false,
					facebookStatus: 'Not authenticated with Facebook!'
				});
			}
		}.bind(this));

		ipcRenderer.send("fb-authenticate", "yes");
	}
	// #!endif

	_closeDialog() {
		this.setState({ showSpinner: true, errorMessage: undefined });

		let promiseLogin;
		if (this.state.facebookAccessToken && this.state.facebookUserId) {
			promiseLogin = STTApi.loginWithFacebook(this.state.facebookAccessToken, this.state.facebookUserId, this.state.autoLogin);
		}
		else {
			promiseLogin = STTApi.login(this.state.username, this.state.password, this.state.autoLogin);
		}

		promiseLogin.then(() => {
			this.setState({ showSpinner: false, hideDialog: true });
			this.props.onAccessToken();
		})
			.catch((error) => {
				console.error(error);
				this.setState({ showSpinner: false, hideDialog: false, errorMessage: error.message });
			});
	}
}
