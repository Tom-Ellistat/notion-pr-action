import { Client, LogLevel } from '@notionhq/client/build/src';
import * as core from '@actions/core';
import { properties } from './properties';
import { createPRMapping, syncNotionDBWithGitHub } from './sync';
import { Octokit } from 'octokit';

function removeHTML(text) {
    return text?.replace(/<.*>.*<\/.*>/g, '') ?? '';
}

function parsePropertiesFromPayload(payload) {
    const parsedBody = removeHTML(payload.pull_requst.body);

    payload.pull_requst.labels?.map(label => label.color);

    const result = {
        Name: properties.title(payload.pull_requst.title),
        Status: properties.getStatusSelectOption(!payload.pull_requst.state),
        Organization: properties.text(payload.organization?.login ?? ''),
        Repository: properties.text(payload.repository.name),
        Number: properties.number(payload.pull_requst.number),
        Body: properties.text(parsedBody),
        Assignees: properties.multiSelect(payload.pull_requst.assignees.map(assignee => assignee.login)),
        Milestone: properties.text(payload.pull_requst.milestone?.title ?? ''),
        Labels: properties.multiSelect(payload.pull_requst.labels?.map(label => label.name) ?? []),
        Author: properties.text(payload.pull_requst.user.login),
        Created: properties.date(payload.pull_requst.created_at),
        Updated: properties.date(payload.pull_requst.updated_at),
        ID: properties.number(payload.pull_requst.id),
        Link: properties.url(payload.pull_requst.html_url),
    };

    return result;
}

async function handlePROpened(options) {
    const { notion, payload } = options;

    core.info(`Creating page for PR #${payload.pull_requst.number}`);

    await notion.client.pages.create({
        parent: {
            database_id: notion.databaseId,
        },
        properties: parsePropertiesFromPayload(payload),
    });
}

async function handlePREdited(options) {
    const { notion, payload } = options;

    core.info(`Querying database for page with github id ${payload.pull_requst.id}`);

    const query = await notion.client.databases.query({
        database_id: notion.databaseId,
        filter: {
            property: 'ID',
            number: {
                equals: payload.pull_requst.id,
            },
        },
        page_size: 1,
    });

    if (query.results.length === 0) {
        core.warning(`Could not find page with github id ${payload.pull_requst.id}`);
        return;
    }

    const pageId = query.results[0].id;

    core.info(`Query successful: Page ${pageId}`);
    core.info(`Updating page for PR #${payload.pull_requst.number}`);

    await notion.client.pages.update({
        page_id: pageId,
        properties: parsePropertiesFromPayload(payload),
    });
}

export async function run(options) {
    const { notion, github } = options;

    core.info('Starting...');

    const notionClient = new Client({
        auth: notion.token,
        logLevel: core.isDebug() ? LogLevel.DEBUG : LogLevel.WARN,
    });

    if (github.payload.action === 'opened') {
        await handlePROpened({
            notion: {
                client: notionClient,
                databaseId: notion.databaseId,
            },
            payload: github.payload,
        });
    } else if (github.eventName === 'workflow_dispatch') {
        const octokit = new Octokit({ auth: core.getInput('github-token') });
        const notion = new Client({ auth: core.getInput('notion-token') });
        const databaseId = core.getInput('notion-db');
        const PRPageIds = await createPRMapping(notion, databaseId);
        if (!github.payload.repository?.full_name) {
            throw new Error('Unable to find repository name in github webhook context');
        }
        const githubRepo = github.payload.repository.full_name;
        await syncNotionDBWithGitHub(PRPageIds, octokit, notion, databaseId, githubRepo);
    } else {
        await handlePREdited({
            notion: {
                client: notionClient,
                databaseId: notion.databaseId,
            },
            payload: github.payload,
        });
    }
    core.info('Complete!');
}