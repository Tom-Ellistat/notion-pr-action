export async function createPRMapping(notion, databaseId) {
    const PRPageIds = [];
    const PRsAlreadyInNotion = await getPRsAlreadyInNotion(notion, databaseId);
    for (const { pageId, PRNumber } of PRsAlreadyInNotion) {
        PRPageIds.push({ PRNumber, pageId });
    }
    return PRPageIds;
}

export async function syncNotionDBWithGitHub(PRPageIds, octokit, notion, databaseId, githubRepo) {
    const PRs = await getGitHubPRs(octokit, githubRepo);
    const pagesToCreate = getPRsNotInNotion(PRPageIds, PRs);
    await createPages(notion, databaseId, pagesToCreate);
}

async function getPRsAlreadyInNotion(notion, databaseId) {
    core.info('Checking for PRs already in the database...');
    const pages = [];
    let cursor = undefined;
    let next_cursor = 'true';
    while (next_cursor) {
        const response = await notion.databases.query({
            database_id: databaseId,
            start_cursor: cursor,
        });
        next_cursor = response.next_cursor;
        const results = response.results;
        pages.push(...results);
        if (!next_cursor) {
            break;
        }
        cursor = next_cursor;
    }
    return pages.map(page => {
        const num = page.properties['Number'];
        return {
            pageId: page.id,
            PRNumber: num.number,
        };
    });
}

async function getGitHubPRs(octokit, githubRepo) {
    core.info('Finding Github PRs...');
    const PRs = [];
    const iterator = octokit.paginate.iterator(octokit.rest.pull_requests.listForRepo, {
        owner: githubRepo.split('/')[0],
        repo: githubRepo.split('/')[1],
        state: 'all',
        per_page: 100,
    });
    for await (const { data } of iterator) {
        for (const PR of data) {
            if (!PR.pull_request) {
                PRs.push(PR);
            }
        }
    }
    return PRs;
}

function getPRsNotInNotion(PRPageIds, PRs) {
    const pagesToCreate = [];
    for (const PR of PRs) {
        if (!PRPageIds.has(PR.number)) {
            pagesToCreate.push(PR);
        }
    }
    return pagesToCreate;
}

async function createPages(notion, databaseId, pagesToCreate) {
    core.info('Adding Github PRs to Notion...');
    await Promise.all(
        pagesToCreate.map(PR =>
            notion.pages.create({
                parent: { database_id: databaseId },
                properties: getPropertiesFromPR(PR),
            })
        )
    );
}

function createMultiSelectObjects(PR) {
    const assigneesObject = PR.assignees.map((assignee) => assignee.login);
    const labelsObject = PR.labels?.map((label) => label.name);
    return { assigneesObject, labelsObject };
}

function getPropertiesFromPR(PR) {
    const {
        number,
        title,
        state,
        id,
        milestone,
        created_at,
        updated_at,
        body,
        repository_url,
        user,
        html_url,
    } = PR;
    const author = user?.login;
    const { assigneesObject, labelsObject } = createMultiSelectObjects(PR);
    const urlComponents = repository_url.split('/');
    const org = urlComponents[urlComponents.length - 2];
    const repo = urlComponents[urlComponents.length - 1];

    // These properties are specific to the template DB referenced in the README.
    return {
        Name: properties.title(title),
        Status: properties.getStatusSelectOption(!state),
        Body: properties.text(body ? body : ''),
        Organization: properties.text(org),
        Repository: properties.text(repo),
        Number: properties.number(number),
        Assignees: properties.multiSelect(assigneesObject),
        Milestone: properties.text(milestone ? milestone.title : ''),
        Labels: properties.multiSelect(labelsObject ? labelsObject : []),
        Author: properties.text(author),
        Created: properties.date(created_at),
        Updated: properties.date(updated_at),
        ID: properties.number(id),
        Link: properties.url(html_url),
    };
}