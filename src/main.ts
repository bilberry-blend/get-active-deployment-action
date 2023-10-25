import * as core from '@actions/core'
import * as github from '@actions/github'
import { format } from 'date-fns'
import {
  ConventionalType,
  gitCheckout,
  commitsToMetadata,
  conventionalNameToEmoji,
  createRelease,
  gitLog,
  groupCommits,
  processCommits,
  gitCurrentBranch
} from './helpers'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  let originalBranch = ''
  try {
    // Get some initial context and inputs necessary for the action
    const prefix: string = core.getInput('prefix', { required: true })
    const token: string = core.getInput('github-token', { required: true })
    const workspace: string = core.getInput('workspace', { required: true })
    const branch = core.getInput('branch', { required: false })
    const from: string = core.getInput('from', { required: true })
    const to: string = core.getInput('to', { required: true })
    const octokit = github.getOctokit(token)

    const date = new Date()
    const releaseTitle = `${prefix}-${format(date, 'yyyy-MM-dd-HH-mm')}`

    // If branch specified, checkout that branch
    if (branch !== '') {
      core.info(`Checking out branch ${branch}`)
      originalBranch = await gitCurrentBranch()
      await gitCheckout(branch)
    }

    // Process all commits since the last release and group them by type
    core.startGroup('Commits in range')
    const commits = await gitLog(from, to)
    for (const commit of commits) {
      core.info(`${commit.sha} - ${commit.message}`)
    }
    core.endGroup()

    core.startGroup('Relevant commits')
    const relevantCommits = await processCommits(commits, workspace)
    for (const commit of relevantCommits) {
      core.info(`${commit.sha} - ${commit.message}`)
    }
    core.endGroup()

    if (relevantCommits.length === 0) {
      core.warning('No relevant commits found, exiting')
      core.setOutput('released', false)
      return
    }

    const metadataList = commitsToMetadata(relevantCommits)
    const groupedMetadata = groupCommits(metadataList)

    core.startGroup('Grouped metadata')
    core.debug(JSON.stringify(groupedMetadata, null, 2))
    core.endGroup()

    // Create a release body from the grouped metadata
    const releaseBody = Object.entries(groupedMetadata)
      .map(([type, list]) => {
        const emoji = conventionalNameToEmoji[type as ConventionalType] // Object.entries trashes the type
        const metadataLines = list.map(metadata => `- ${metadata.description}`)
        return `${emoji} **${type}**\n\n${metadataLines.join('\n')}`
      })
      .join('\n\n\n')

    // Create a release
    const release = await createRelease(
      octokit,
      github.context,
      releaseTitle,
      releaseBody
    )

    // Add release URL as an output
    core.setOutput('released', true)
    core.setOutput('release-url', release.html_url)
    core.setOutput('release-title', release.name)
    core.setOutput('release-body', release.body)
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setOutput('released', false)
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  } finally {
    if (originalBranch !== '') {
      // If we changed branches, switch back
      core.info(`Checking out original branch ${originalBranch}`)
      await gitCheckout(originalBranch)
    }
  }
}
