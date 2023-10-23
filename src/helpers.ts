import { exec } from '@actions/exec'
import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'
import * as core from '@actions/core'
import { DryRunJson } from './turbo'

type Octokit = ReturnType<typeof github.getOctokit>
type CreateRelease = Octokit['rest']['repos']['createRelease']
type CreateReleaseResponse = Awaited<ReturnType<CreateRelease>>['data']

export const conventionalNameToEmoji = {
  build: '👷',
  chore: '🧹',
  ci: '🤖',
  docs: '📝',
  feat: '✨',
  fix: '🐛',
  perf: '⚡️',
  refactor: '♻️',
  revert: '⏪',
  style: '🎨',
  test: '✅'
}

export type ConventionalType = keyof typeof conventionalNameToEmoji

/**
 * Checks if a commit message is a conventional commit.
 */
function conventionalCommit(message: string): boolean {
  // No capture groups or length limits, just a simple regex to check if the message matches the conventional commit format
  // Check that type is one of the conventional types
  const regex =
    /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\(.+\))?: .+/
  return regex.test(message)
}

export interface CommitMetadata {
  type: keyof typeof conventionalNameToEmoji
  scope?: string
  description: string
}

function extractCommitMetadata(message: string): CommitMetadata | null {
  const regex =
    /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\(.+\))?: (.+)/
  const match = regex.exec(message)
  if (match === null) {
    return null
  }
  return {
    type: match[1] as ConventionalType,
    scope: match[2],
    description: match[3]
  }
}

export async function gitCurrentBranch(): Promise<string> {
  // Get current branch name
  let currentBranch = ''
  const exitCode = await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    listeners: {
      stdout: (data: Buffer) => {
        currentBranch += data.toString()
      }
    }
  })
  if (exitCode !== 0) {
    throw new Error('Failed to get current branch')
  }
  return currentBranch.trim()
}

export async function gitCheckout(branch: string): Promise<void> {
  const result = await exec('git', ['checkout', branch])
  if (result !== 0) {
    throw new Error(`Failed to checkout branch ${branch}`)
  }
}

export interface GitLog {
  sha: string
  message: string
}

/**
 * Get the list of shas between the current and previous sha.
 * Uses git log to print the sha and commit message header for each commit.
 * @param currentSha
 * @param previousSha
 * @returns List of shas between the current and previous sha
 */
export async function gitLog(from: string, to: string): Promise<GitLog[]> {
  let shas = ''
  const isSameSha = from === to
  const range = isSameSha ? `${to} -1` : `${from}..${to}`
  const result = await exec(
    'git',
    ['log', `${range}`, `--pretty=format:%H %s`],
    {
      listeners: {
        stdout: (data: Buffer) => {
          shas += data.toString()
        }
      }
    }
  )

  if (result !== 0) {
    throw new Error('Failed to get git log')
  }

  const commits = shas.split('\n').map(commit => {
    // Split sha and message
    const [sha, ...message] = commit.split(' ')
    return { sha, message: message.join(' ') } // Not very efficient, but it's a small string
  })

  return commits
}

export async function releaseSha(
  octokit: Octokit,
  context: Context,
  environment: string
): Promise<string> {
  // Get deployment statuses for the selected environment
  const deploymentStatuses = await octokit.rest.repos.listDeployments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    environment
  })

  let previousSha: string

  // Find commit ref for the latest deployment, if any
  if (deploymentStatuses.data.length > 0) {
    const latestDeployment = deploymentStatuses.data[0]
    previousSha = latestDeployment.sha
  } else {
    previousSha = context.sha
  }

  return previousSha
}

export async function processCommits(
  commits: GitLog[],
  workspace: string
): Promise<GitLog[]> {
  const relevantCommits: GitLog[] = []

  // Checkout commit using shell script
  for (const commit of commits) {
    const checkout = await exec('git', ['checkout', commit.sha])
    if (checkout !== 0) {
      continue
    }
    let result = ''
    const exitCode = await exec(
      'npx',
      [
        'turbo',
        'run',
        'build',
        `--filter='${workspace}...[${commit.sha}^1]'`,
        '--dry=json'
      ],
      {
        listeners: {
          stdout: (data: Buffer) => {
            result += data.toString()
          }
        }
      }
    )

    if (exitCode !== 0) {
      continue
    }

    // Parse output and see if commit affects workspace
    const json = JSON.parse(result) as DryRunJson

    const packages = json.packages
    const isMonorepo = json.monorepo
    const isConventionalCommit = conventionalCommit(commit.message)

    core.debug(`Packages: ${packages}`)
    core.debug(`Is monorepo: ${isMonorepo}`)
    core.debug(`Is conventional commit: ${isConventionalCommit}`)

    if ((!isMonorepo || packages.includes(workspace)) && isConventionalCommit) {
      relevantCommits.push(commit)
    }
  }
  return relevantCommits
}

function commitToMetadata(commit: GitLog): CommitMetadata | null {
  return extractCommitMetadata(commit.message)
}

export function commitsToMetadata(commits: GitLog[]): CommitMetadata[] {
  return commits
    .map(c => commitToMetadata(c))
    .filter((c): c is CommitMetadata => c !== null)
}

export function groupCommits(
  commits: CommitMetadata[]
): Record<keyof typeof conventionalNameToEmoji, CommitMetadata[]> {
  return commits.reduce(
    (acc, metadata) => {
      if (!acc[metadata.type]) {
        acc[metadata.type] = []
      }
      acc[metadata.type].push(metadata)
      return acc
    },
    {} as Record<keyof typeof conventionalNameToEmoji, CommitMetadata[]>
  )
}

// Primarily extracted as a helper for easier mocking in tests
export async function createRelease(
  octokit: Octokit,
  context: Context,
  releaseTitle: string,
  releaseBody: string
): Promise<CreateReleaseResponse> {
  const result = await octokit.rest.repos.createRelease({
    owner: context.repo.owner,
    repo: context.repo.repo,
    tag_name: releaseTitle,
    name: releaseTitle,
    body: releaseBody,
    draft: false,
    prerelease: false
  })

  return result.data
}
