const NOTION_TOKEN_KEY = 'secret_yeQg15eQdxGepQHkojNJhhab39uhqo5kTP4FvBzV3pD';
// const NOTION_DB_KEY = '96e254bd927a471d8b2f403b50f46067';

const core = require("@actions/core");
// const github = require("@actions/github");
const { Client } = require("@notionhq/client")

const { extractParams } = require('./githubParams')

const URL_REGEX = "(https)://([\\w_-]+(?:(?:.[\\w_-]+)+))([\\w.,@?^=%&:/~+#-]*[\\w@?^=%&/~+#-])?";

const params = extractParams();

const enhancedRegex = `${params.prefix}${URL_REGEX}${params.suffix}`;

const urls = params.pullRequest.body.match(enhancedRegex) ?? [];
const urlFound = urls.find((url) => url.match("notion.so"));

if (urlFound) {
    const notionUrlParts = urlFound
        .match(URL_REGEX)
        .find((url) => url.match("notion.so"))
        .split("/");

    const taskName = notionUrlParts[notionUrlParts.length - 1];

    const taskParts = taskName.split("-");
    const pageId = taskParts[taskParts.length - 1];

    const notion = new Client({
        auth: NOTION_TOKEN_KEY
    })

    notion.pages.update({
        page_id: pageId,
        properties: {
            ...(
                params.pullRequest.status ? {
                    [params.notionProperties.status]: {
                        name: params.pullRequest.status,
                    },
                } : {}
            ),
            [params.notionProperties.githubUrl]: params.pullRequest.href,
        }
    }).then(() => {
        if (!params.pullRequest.status) {
            core.info(
                `The status ${params.metadata.statusKey} is not mapped with a value in the action definition. Hence, the task update body does not contain a status update`
            );
        }
        core.info("Notion task updated!");
    }).catch((err) => { core.setFailed(err); })
} else {
    core.warning("No notion task found in the PR body.");
}