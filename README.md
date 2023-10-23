# Turbo Monorepo Release Action

Create release for a Turbo Monorepo for a commit range. It is intended to be
used in a workflow that creates a deployment. The action accepts two commits
representing a range.

These commits are then filtered down by two criteria:

1. The commit subject matches the conventional commit format
1. The commit triggers a change in the workspace as defined by turbo build

They are grouped by type (fix, feat, etc) and a release is created using the
GitHub API. The release content is set as action output, so it can be used in
subsequent steps.

## Pre-requisites

You need to have setup node and npx in your workflow before using this action.

```yaml
steps:
  - name: Setup node
    uses: actions/setup-node@v2
    with:
      node-version: '20'
```

## Inputs

| Name           | Description                          | Required | Default |
| -------------- | ------------------------------------ | -------- | ------- |
| `github-token` | GitHub token                         | true     |         |
| `workspace`    | Turbo workspace name                 | true     |         |
| `prefix`       | Prefix for release title             | false    | ""      |
| `from`         | Commit SHA to start from (exclusive) | true     |         |
| `to`           | Commit SHA to end at                 | true     |         |

## Outputs

| Name            | Description           |
| --------------- | --------------------- |
| `release-title` | Release title         |
| `release-body`  | Release description   |
| `release-url`   | Release URL to GitHub |

## Example usage

```yaml
on: [deployment]
# Release job:
jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    permissions:
      contents: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Create release
        uses: go-fjords/create-release-from-deployment-action@v1
        with:
          # We need the token with write permissions to do git operations and create the release
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # The name of the turbo/pnpm workspace to check for changes
          workspace: my-workspace
          # The prefix is used to create the release title
          prefix: 'My App'
          # Get the start commit for the release (exclusive, not part of the release)
          from: 6b81ece3474de57f7fa070192fa1b88e303acb2a
          # Get the final commit for the release (inclusive, part of the release)
          to: ${{ github.event.deployment.ref }}
      - name: Print release URL
        run: echo ${{ steps.create-release.outputs.release-url }}
```
