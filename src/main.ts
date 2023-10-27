import * as core from '@actions/core'
import * as github from '@actions/github'
import { fetchDeploymentStatus, getDeploymentById } from './helpers'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get some initial context and inputs necessary for the action
    const environment: string = core.getInput('environment', { required: true })
    const token: string = core.getInput('github-token')
    const nth = core.getInput('nth')
    const owner = core.getInput('owner')
    const repo = core.getInput('repo')
    const octokit = github.getOctokit(token)
    const nthInt = parseInt(nth, 10)

    const context = {
      owner,
      repo
    }

    // Get id of the most recent active deployment in the specified environment
    core.info(
      `Looking for most recent active deployment in environment ${environment}`
    )
    const deploymentId = await fetchDeploymentStatus(
      octokit,
      context,
      environment,
      nthInt
    )

    // If no active deployment was found, we're done
    if (!deploymentId) {
      core.warning(`No active deployment found in environment ${environment}`)
      return
    }

    // Otherwise fetch the deployment object
    core.info(`Fetching deployment ${deploymentId}`)
    const deployment = await getDeploymentById(octokit, context, deploymentId)

    // Finally set the output variables
    core.info(`Setting output variables`)
    core.setOutput('deployment-id', deploymentId)
    core.setOutput('deployment-sha', deployment.sha)
    core.setOutput('deployment', deployment)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  }
}
