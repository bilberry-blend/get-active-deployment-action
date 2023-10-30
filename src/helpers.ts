import * as github from '@actions/github'

type Octokit = ReturnType<typeof github.getOctokit>
type Deployment = Awaited<
  ReturnType<Octokit['rest']['repos']['getDeployment']>
>['data']

export interface Context {
  owner: string
  repo: string
}

interface Deployments {
  nodes: {
    databaseId: number
    state: string
  }[]
  pageInfo: {
    hasNextPage: boolean
    endCursor: string
  }
}

export interface DeploymentsGraphQLResponse {
  repository: {
    deployments: Deployments
  }
}

/**
 * Fetches one page of deployments in the specified environment.
 * If a cursor is provided, fetches the next page of deployments.
 * If no cursor is provided, fetches the first page of deployments.
 * @param octokit
 * @param context
 * @param environment
 * @param first
 * @param cursor
 * @returns the deployments object with the nodes and pageInfo properties
 */
export async function fetchDeployments(
  octokit: Octokit,
  context: Context,
  environment: string,
  first = 20,
  cursor?: string
): Promise<Deployments> {
  // Query the deployments in the environment
  // Sort by createdAt descending, so the most recent deployment is first
  // Limit the number of deployments to the last 20
  // If a cursor is provided, use that to paginate to the next page of results
  const data = await octokit.graphql<DeploymentsGraphQLResponse>(
    `
    query fetchDeployments($owner: String!, $repo: String!, $environment: String!, $first: Int!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        deployments(
          first: $first,
          environments: [$environment],
          orderBy: {field: CREATED_AT, direction: DESC},
          after: $cursor
        ) {
          nodes {
            databaseId
            state
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `,
    {
      first,
      cursor,
      environment,
      owner: context.owner,
      repo: context.repo
    }
  )

  return data.repository.deployments
}

/**
 * Finds the most recent active deployment in specified environment, if any.
 * Politely pages through the deployments using the GitHub GraphQL API.
 * We return the databaseId of the deployment, which can be used to fetch the deployment
 * from the GitHub REST API.
 * @param octokit
 * @param context
 * @param environment
 * @returns the deployment id if found, otherwise null
 */
export async function fetchDeploymentStatus(
  octokit: Octokit,
  context: Context,
  environment: string,
  nth: number
): Promise<number | null> {
  let deploymentId
  let cursor
  let hasNextPage = true
  let found = 0
  while (hasNextPage) {
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 100)) // Polite rate limiting
    }

    const deployments = await fetchDeployments(
      octokit,
      context,
      environment,
      20,
      cursor
    )
    for (const deployment of deployments.nodes.filter(
      d => d.state === 'ACTIVE' || d.state === 'INACTIVE'
    )) {
      if (found === nth) {
        break
      }
      deploymentId = deployment.databaseId
      found++
    }

    cursor = deployments.pageInfo.endCursor
    hasNextPage = deployments.pageInfo.hasNextPage
  }

  return deploymentId ?? null
}

/**
 * Fetches the full deployment object by ID using GitHub REST API.
 * @param octokit
 * @param context
 * @param deploymentId
 * @returns the deployment object
 */
export async function getDeploymentById(
  octokit: Octokit,
  context: Context,
  deploymentId: number
): Promise<Deployment> {
  const { data } = await octokit.rest.repos.getDeployment({
    deployment_id: deploymentId,
    owner: context.owner,
    repo: context.repo
  })

  return data
}
