/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as main from '../src/main'
import * as helpers from '../src/helpers'

type Octokit = ReturnType<typeof github.getOctokit>
type Deployment = Awaited<
  ReturnType<Octokit['rest']['repos']['getDeployment']>
>['data']

// Mock the GitHub Actions core library
const getInputMock = jest.spyOn(core, 'getInput')
const setFailedMock = jest.spyOn(core, 'setFailed')
const setOutputMock = jest.spyOn(core, 'setOutput')
const warningMock = jest.spyOn(core, 'warning')

// Mock the side-effecting helper functions from src/helpers.ts
const fetchDeploymentStatusMock = jest.spyOn(helpers, 'fetchDeploymentStatus')
const getDeploymentByIdMock = jest.spyOn(helpers, 'getDeploymentById')

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    Object.defineProperty(github, 'context', {
      value: {
        repo: {
          owner: 'octocat',
          repo: 'Hello-World'
        }
      }
    })

    fetchDeploymentStatusMock.mockImplementation(async () => {
      return Promise.resolve(1234567890)
    })

    getDeploymentByIdMock.mockImplementation(async () => {
      return Promise.resolve({
        created_at: '2021-01-01T00:00:00Z',
        id: 1234567890,
        sha: '1234567890'
      } as Deployment)
    })
  })

  it('creates release and sets the release outputs', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'environment':
          return 'production-my-app'
        case 'github-token':
          return '1234567890'
        case 'owner':
          return 'octocat'
        case 'repo':
          return 'Hello-World'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'deployment-id',
      1234567890
    )
    expect(setOutputMock).toHaveBeenNthCalledWith(
      2,
      'deployment-sha',
      '1234567890'
    )
    expect(setOutputMock).toHaveBeenNthCalledWith(3, 'deployment', {
      created_at: '2021-01-01T00:00:00Z',
      id: 1234567890,
      sha: '1234567890'
    })
  })

  it('sets a failed status if fetchDeploymentStatus fails', async () => {
    // Set the action's inputs as return values from core.getInput()
    fetchDeploymentStatusMock.mockImplementation(() => {
      throw new Error('Failed to fetch deployment status')
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Failed to fetch deployment status'
    )
  })

  it('sets a failed status if getDeploymentById fails', async () => {
    // Set the action's inputs as return values from core.getInput()
    getDeploymentByIdMock.mockImplementation(() => {
      throw new Error('Failed to get deployment by id')
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Failed to get deployment by id'
    )
  })

  it('should print warning if no active deployment is found', async () => {
    // Set the action's inputs as return values from core.getInput()
    fetchDeploymentStatusMock.mockImplementation(async () => {
      return Promise.resolve(null)
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly

    expect(warningMock).toHaveBeenCalledTimes(1)
    expect(setFailedMock).toHaveBeenCalledTimes(0) // Should not fail the workflow
    expect(setOutputMock).toHaveBeenCalledTimes(0) // Should not set any outputs, either
  })

  it('should handle errors of unknown type', async () => {
    // Set the action's inputs as return values from core.getInput()
    fetchDeploymentStatusMock.mockImplementation(async () => {
      // eslint-disable-next-line prefer-promise-reject-errors
      return Promise.reject('Unknown error')
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'An unknown error occurred'
    )
  })

  it('should default owner and repo to the current repository as defined in github context', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockClear() // Clear the mock so we can set different return values
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'environment':
          return 'production-my-app'
        case 'github-token':
          return '1234567890'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'deployment-id',
      1234567890
    )
    expect(setOutputMock).toHaveBeenNthCalledWith(
      2,
      'deployment-sha',
      '1234567890'
    )
    expect(setOutputMock).toHaveBeenNthCalledWith(3, 'deployment', {
      created_at: '2021-01-01T00:00:00Z',
      id: 1234567890,
      sha: '1234567890'
    })
  })
})
