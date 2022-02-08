const core = require('@actions/core');
const github = require('@actions/github');
const run = require('./action');

const NOTION_TOKEN_KEY = 'secret_yeQg15eQdxGepQHkojNJhhab39uhqo5kTP4FvBzV3pD';
const NOTION_DB_KEY = '96e254bd927a471d8b2f403b50f46067';

async function start() {
    try {
        const notionToken = core.getInput(NOTION_TOKEN_KEY, { required: true });
        const notionDb = core.getInput(NOTION_DB_KEY, { required: true });

        core.info(`context event: ${github.context.eventName}`);
        core.info(`context action: ${github.context.action}`);
        core.info(`payload action: ${github.context.payload.action}`);
        const options = {
            notion: {
                token: notionToken,
                databaseId: notionDb,
            },
            github: {
                payload: github.context.payload,
                eventName: github.context.eventName,
            },
        };

        await run(options);
    } catch (e) {
        core.setFailed(e instanceof Error ? e.message : e + '');
    }
}

(async () => {
    await start();
})();