# Get Last Active Deployment Action

![GitHub Workflow Status](./badges/coverage.svg)
[![Check dist/](https://github.com/go-fjords/get-active-deployment-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/go-fjords/get-active-deployment-action/actions/workflows/check-dist.yml)
[![Continuous Integration](https://github.com/go-fjords/get-active-deployment-action/actions/workflows/ci.yml/badge.svg)](https://github.com/go-fjords/get-active-deployment-action/actions/workflows/ci.yml)
[![Lint Code Base](https://github.com/go-fjords/get-active-deployment-action/actions/workflows/linter.yml/badge.svg)](https://github.com/go-fjords/get-active-deployment-action/actions/workflows/linter.yml)

Finds nth most recent deployment for a given environment. Useful for creating
releases from deployments.

## Usage

```yaml
job:
  name: Get last active deployment
  runs-on: ubuntu-latest
  # Give the job access to deployments
  permissions:
    deployments: read
  steps:
    - name: Get last active deployment
      uses: go-fjords/get-active-deployment-action@v0
      id: get-deployment
      with:
        environment: production
```

## Inputs

| Name           | Description                      | Required | Default                             |
| -------------- | -------------------------------- | -------- | ----------------------------------- |
| `github-token` | GitHub token                     | false    | Defaults to the GitHub action token |
| `environment`  | Deployment environment           | true     |                                     |
| `repository`   | GitHub owner and repository name | false    | Defaults to current repository      |
| `nth`          | Nth deployment (1 based)         | false    | 1                                   |

## Outputs

| Name             | Description                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deployment-id`  | Deployment ID (numeric)                                                                                                                            |
| `deployment-sha` | Deployment SHA (full)                                                                                                                              |
| `deployment`     | Full [deployment object](https://docs.github.com/en/rest/deployments/deployments?apiVersion=2022-11-28#get-a-deployment) from REST API stringified |

## Example usage

See a more complete example below that illustrates how to use this action. For
more advanced examples, see the [example-workflows](./example-workflows)
directory.

```yaml
jobs:
  get-deployment:
    name: Get last active deployment
    runs-on: ubuntu-latest
    # Give the job access to deployments
    permissions:
      deployments: read
    steps:
      - name: Get last active deployment
        uses: go-fjords/get-active-deployment-action@v0
        id: get-deployment
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          environment: production
          repository: my-org/my-repo
          nth: 2 # Get the second most recent deployment
```

## Development

Node v20 or later is recommended.

```bash
npm install
npm run all
```

You should run the action locally using [act](https://github.com/nektos/act).
This allows you to test the action in a simulated GitHub workflow before pushing
a PR. act requires Docker to be installed.

```bash
# List available workflow jobs to run
act -l

# Run the test-action job to run the action locally
act -j test-action -s GITHUB_TOKEN="$(gh auth token)"
```

This will run the action locally using the `test-action` job defined in the
[test.yml](./.github/workflows/ci.yml) workflow. If you don't have write access
to the original repository, you can fork it and run the action from your fork
instead. If you do not, the action will error out when it tries to create the
release.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for information on how to contribute to
this project.

## License

See [LICENSE](./LICENSE) for information on the license for this project. In
short, this project is licensed under the MIT license.
