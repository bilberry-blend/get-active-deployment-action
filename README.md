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

See a simple example below that illustrates how to use this action.
For more advanced examples, see the [example-workflows](./example-workflows) directory.

```yaml
on:
  - deployment_status
# Release job:
jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    permissions:
      contents: write
    if: ${{ startsWith(github.event.deployment.environment, 'production-') && github.event.deployment_status.state == 'success' }}
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

## Example release body output

The release body is generated from the commit messages in the range.

```markdown
👷 **build**

- Bump actions/setup-node from 2 to 4 (#12)


📝 **docs**

- Improve documentation (#13)
```

## Development

Node v20 or later is recommended.

```bash
npm install
npm run all
```

You should run the action locally using [act](https://github.com/nektos/act).
This allows you to test the action in a simulated GitHub workflow before pushing a PR.
act requires Docker to be installed.

```bash
# List available workflow jobs to run
act -l

# Run the test-action job to run the action locally
act -j test-action -s GITHUB_TOKEN="$(gh auth token)"
```

This will run the action locally using the `test-action` job defined in the [test.yml](./.github/workflows/ci.yml) workflow.
If you don't have write access to the original repository, you can fork it and run the action from your fork instead.
If you do not, the action will error out when it tries to create the release.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for information on how to contribute to this project.

## License

See [LICENSE](./LICENSE) for information on the license for this project.
In short, this project is licensed under the MIT license.
