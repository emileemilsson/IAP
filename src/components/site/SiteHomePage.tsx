import React from 'react';

import { Container, Header, Divider, Grid, Button, Icon, List, Label, Form, Message } from 'semantic-ui-react';

import STTApi from '../../api';

export const SiteHomePage = (props: {
    onAccessToken: () => void;
}) => {
    const [errorMessage, setErrorMessage] = React.useState<string | undefined>(undefined);
    const [autoLogin, setAutoLogin] = React.useState<boolean>(true);
    const [showSpinner, setShowSpinner] = React.useState<boolean>(false);
    // const [agreePolicy, setAgreePolicy] = React.useState<boolean>(false);
    const [username, setUsername] = React.useState<string>('');
    const [password, setPassword] = React.useState<string>('');

    return <Container text>
        <Header as='h1' dividing>IAmPicard's Star Trek Timelines tools</Header>
        <p>Companion tools for the <a href="https://www.disruptorbeam.com/games/star-trek-timelines/" target='_blank'>Star Trek Timelines</a> game</p>

        <Header as='h3'>Online version of the tool <span style={{ color: 'red' }}>- BETA</span></Header>

        <Message attached>
            Login below using your Start Trek Timelines username and password. If you're using Facebook, Steam or a mobile platform
            and have yet to set up your account, please see instructions <a href='https://startrektimelines.zendesk.com/hc/en-us/articles/215687778-How-do-I-register-my-Star-Trek-Timelines-account-' target='_blank'>here</a>.
        </Message>
        <Form className='attached fluid segment' loading={showSpinner} onSubmit={_closeDialog}>
            <Form.Input label='Username' placeholder='Username (e-mail) or access token' type='text' value={username} onChange={(e, d) => { setUsername(d.value) }} />
            <Form.Input label='Password' type='password' value={password} onChange={(e, d) => { setPassword(d.value) }} />
            {/* <Form.Checkbox inline checked={agreePolicy} onChange={(e, d) => { setAgreePolicy(d.checked === undefined ? false : d.checked) }} label={<label>I have read
                and agree to the <a href='https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet#privacy-and-security' target='_blank' >Privacy Policy</a></label>} /> */}
            <Button color='blue' disabled={showSpinner /*|| !agreePolicy*/}>Login</Button>
        </Form>
        <Message attached='bottom' error hidden={!errorMessage}>
            {errorMessage}
        </Message>

        <Header as='h3'>Miscellaneous links</Header>
        <List>
            <List.Item icon='linkify' content={<a href="https://www.disruptorbeam.com/games/star-trek-timelines/" target='_blank'>Official game page</a>} />
            <List.Item icon='linkify' content={<a href="https://forum.disruptorbeam.com/stt/" target='_blank'>Official game forums</a>} />
            <List.Item icon='linkify' content={<a href="https://stt.wiki/wiki/Main_Page" target='_blank'>Wiki (player contributed, lots of useful info)</a>} />
            <List.Item icon='linkify' content={<a href="https://discord.gg/8Du7ZtJ" target='_blank'>Discord channel</a>} />
            <List.Item icon='linkify' content={<a href="https://www.reddit.com/r/StarTrekTimelines/" target='_blank'>Subreddit</a>} />
        </List>

        <br />
        <Label size="small"><b>DISCLAIMER</b> This tool is provided "as is", without warranty of any kind. Use at your own risk! It should be understood that
         Star Trek Timelines content and materials are trademarks and copyrights of <a href='https://www.disruptorbeam.com/tos/' target='_blank'>Disruptor
         Beam, Inc.</a> or its licensors. All rights reserved. This tool is neither endorsed by nor affiliated with Disruptor Beam, Inc..</Label>
    </Container>;

    function _closeDialog() {
        setShowSpinner(true);
        setErrorMessage(undefined);

        let promiseLogin = STTApi.login(username, password, autoLogin);

        promiseLogin.then(() => {
            setShowSpinner(false);
            props.onAccessToken();
        })
        .catch((error) => {
            console.error(error);
            setShowSpinner(false);
            setErrorMessage(error.message);
        });
    }
}