import { getInput } from "@actions/core";
import { context } from "@actions/github";

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function extractGithubParams() {
    const pullRequest = context.payload.pull_request;

    const requiredPrefix = escapeRegExp(
        getInput("required-prefix", { required: false }) || ""
    );

    const requiredSuffix = escapeRegExp(
        getInput("required-suffix", { required: false }) || ""
    );

    const isDraft = context.payload.pull_request?.draft
    const isMerged = context.payload.pull_request?.merged
    const statusKey = isMerged ? 'merged' : isDraft ? 'draft' : context.payload.action
    const status = getInput(statusKey, { required: false });

    const githubUrlProperty = getInput("github-url-property-name", { required: false }) ||
        "Github Url";

    const statusProperty = getInput("status-property-name", { required: false }) || "Status";

    return {
        metadata: {
            statusKey: statusKey
        },
        pullRequest: {
            body: pullRequest.body ?? '',
            href: pullRequest.html_url,
            status: status
        },
        suffix: requiredSuffix,
        prefix: requiredPrefix,
        notionProperties: {
            githubUrl: githubUrlProperty,
            status: statusProperty
        }
    }
}

export const extractParams = extractGithubParams;