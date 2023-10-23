/**
 * Unit tests for src/wait.ts
 */
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as helpers from '../src/helpers'
import { expect } from '@jest/globals'
import { Context } from '@actions/github/lib/context'

type Octokit = ReturnType<typeof github.getOctokit>
type ListDeployments = Octokit['rest']['repos']['listDeployments']
type ListDeploymentsResponse = Awaited<ReturnType<ListDeployments>>
type CreateRelease = Octokit['rest']['repos']['createRelease']
type CreateReleaseResponse = Awaited<ReturnType<CreateRelease>>

describe('helpers.ts', () => {
  describe('gitCurrentBranch', () => {
    const execMock = jest.spyOn(exec, 'exec')
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('returns the current branch', async () => {
      execMock.mockImplementation(async (_cmd, _args, opts) => {
        const stdout = 'test'
        opts?.listeners?.stdout?.(Buffer.from(stdout))
        return Promise.resolve(0)
      })
      const branch = await helpers.gitCurrentBranch()
      expect(branch).toBe('test')
    })

    it('throws an error if git rev-parse fails', async () => {
      execMock.mockImplementation(async (_cmd, _args, opts) => {
        const stdout =
          'fatal: not a git repository (or any of the parent directories): .git'
        opts?.listeners?.stdout?.(Buffer.from(stdout))
        return Promise.resolve(1)
      })
      await expect(helpers.gitCurrentBranch()).rejects.toThrow()
    })
  })

  describe('gitCheckout', () => {
    const execMock = jest.spyOn(exec, 'exec')
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('calls git checkout', async () => {
      execMock.mockImplementation(async (_cmd, _args, opts) => {
        const stdout = `Switched to branch 'test'
        Your branch is up to date with 'origin/test'.`
        opts?.listeners?.stdout?.(Buffer.from(stdout))
        return Promise.resolve(0)
      })
      await helpers.gitCheckout('test')
      expect(execMock).toHaveBeenCalledWith('git', ['checkout', 'test'])
    })

    it('should throw error if git checkout fails', async () => {
      execMock.mockImplementation(async (_cmd, _args, opts) => {
        const stdout =
          'fatal: not a git repository (or any of the parent directories): .git'
        opts?.listeners?.stdout?.(Buffer.from(stdout))
        return Promise.resolve(1)
      })
      await expect(helpers.gitCheckout('test')).rejects.toThrow()
    })
  })

  describe('gitLog', () => {
    const execMock = jest.spyOn(exec, 'exec')
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('returns a list of commits', async () => {
      // Mock out git log
      execMock.mockImplementation(async (_cmd, _args, opts) => {
        const stdout = `1234567890 test commit
2345678901 test commit
3456789012 test commit`
        opts?.listeners?.stdout?.(Buffer.from(stdout))
        return Promise.resolve(0)
      })

      const commits = await helpers.gitLog('HEAD~3', 'HEAD')

      expect(commits.length).toBe(3)
      expect(commits[0].sha).toBeTruthy()
      expect(commits[0].message).toBeTruthy()
    })

    it('throws an error if git log fails', async () => {
      execMock.mockImplementation(async (_cmd, _args, opts) => {
        const stdout =
          "fatal: your current branch 'notabranch' does not have any commits yet"
        opts?.listeners?.stdout?.(Buffer.from(stdout))
        return Promise.resolve(1)
      })
      await expect(helpers.gitLog('notabranch', 'HEAD~2')).rejects.toThrow()
    })

    it('throws an error if git log returns a non-zero exit code', async () => {
      execMock.mockImplementationOnce(async () => {
        return Promise.resolve(1)
      })

      await expect(helpers.gitLog('HEAD', 'HEAD~2')).rejects.toThrow()
    })
  })

  describe('processCommits', () => {
    const execMock = jest.spyOn(exec, 'exec')
    const gitLogMock = jest.spyOn(helpers, 'gitLog')
    // Mock commits

    beforeEach(() => {
      const turboStdout = {
        packages: ['test']
      }
      execMock.mockImplementation(async (_cmd, _args, opts) => {
        const stdout = JSON.stringify(turboStdout)
        opts?.listeners?.stdout?.(Buffer.from(stdout))
        return Promise.resolve(0)
      })
      gitLogMock.mockImplementation(async () => {
        return Promise.resolve([
          {
            sha: '2345678901',
            message: 'fix: Fixed timezone bug in date picker'
          },
          {
            sha: '1234567890',
            message: 'Commit that does not match conventional commit format'
          },
          {
            sha: '3456789012',
            message: 'feat: Added awesome date picker'
          }
        ])
      })
    })

    afterAll(() => {
      jest.clearAllMocks()
    })

    it('returns a list of conventional commits', async () => {
      const commits = await helpers.gitLog('HEAD', 'HEAD~2')
      const processedCommits = await helpers.processCommits(commits, 'test')
      expect(processedCommits.length).toBe(2)
      expect(processedCommits[0].sha).toBeTruthy()
      expect(processedCommits[0].message).toBeTruthy()
    })

    it('gracefully continues processing if exit code is non-zero', async () => {
      execMock.mockImplementationOnce(async () => {
        return Promise.resolve(1)
      })

      const commits = await helpers.gitLog('HEAD', 'HEAD~2')
      const processedCommits = await helpers.processCommits(commits, 'test')
      expect(processedCommits.length).toBe(1) // one commit was filtered out when command failed
      expect(processedCommits[0].sha).toBeTruthy()
      expect(processedCommits[0].message).toBeTruthy()
    })

    it('include commit if turborepo output reports "monorepo": false', async () => {
      const turboStdout = {
        monorepo: false
      }

      execMock.mockImplementation(async (_cmd, _args, opts) => {
        const stdout = JSON.stringify(turboStdout)
        opts?.listeners?.stdout?.(Buffer.from(stdout))
        return Promise.resolve(0)
      })

      const commits = await helpers.gitLog('HEAD', 'HEAD~2')
      const processedCommits = await helpers.processCommits(commits, 'test')
      expect(processedCommits.length).toBe(2) // no commits were filtered out
      expect(processedCommits[0].sha).toBeTruthy()
      expect(processedCommits[0].message).toBeTruthy()
    })
  })

  describe('releaseSha', () => {
    const octokitMock = {
      rest: {
        repos: {
          listDeployments: jest.fn()
        }
      }
    }

    it('returns the sha of the last release', async () => {
      octokitMock.rest.repos.listDeployments.mockImplementation(async () => {
        return Promise.resolve({
          headers: {},
          status: 200,
          url: '',
          data: [
            {
              sha: '1234567890'
            },
            {
              sha: '2345678901'
            }
          ]
        } as ListDeploymentsResponse)
      })

      const sha = await helpers.releaseSha(
        octokitMock as unknown as Octokit,
        {
          repo: {
            owner: 'test',
            repo: 'test'
          }
        } as unknown as typeof github.context,
        'production'
      )

      expect(sha).toBe('1234567890')
    })

    it('rethrows list deployments error if request fails', async () => {
      octokitMock.rest.repos.listDeployments.mockImplementation(async () => {
        return Promise.reject(new Error('could not fetch error'))
      })

      await expect(
        helpers.releaseSha(
          octokitMock as unknown as Octokit,
          {
            repo: {
              owner: 'test',
              repo: 'test'
            }
          } as unknown as typeof github.context,
          'production'
        )
      ).rejects.toThrow('could not fetch error')
    })

    it('should return the current sha if no deployments exist', async () => {
      octokitMock.rest.repos.listDeployments.mockImplementation(async () => {
        return Promise.resolve({
          headers: {},
          status: 200,
          url: '',
          data: []
        } as ListDeploymentsResponse)
      })

      const sha = await helpers.releaseSha(
        octokitMock as unknown as Octokit,
        {
          repo: {
            owner: 'test',
            repo: 'test'
          },
          sha: '1234567890'
        } as unknown as typeof github.context,
        'production'
      )

      expect(sha).toBe('1234567890')
    })
  })

  describe('commitsToMetadata', () => {
    it('returns a list of metadata objects', () => {
      const commits: helpers.GitLog[] = [
        {
          sha: '1234567890',
          message: 'fix: Fixed timezone bug in date picker'
        },
        {
          sha: '2345678901',
          message: 'feat: Added awesome date picker'
        }
      ]

      const metadata = helpers.commitsToMetadata(commits)
      expect(metadata.length).toBe(2)
      expect(metadata[0]).toEqual({
        type: 'fix',
        description: 'Fixed timezone bug in date picker'
      })
    })

    it('should filter out commits that does not match conventional commit format', () => {
      const commits: helpers.GitLog[] = [
        {
          sha: '1234567890',
          message: 'fix: Fixed timezone bug in date picker'
        },
        {
          sha: '2345678901',
          message: 'Commit that does not match conventional commit format'
        }
      ]

      const metadata = helpers.commitsToMetadata(commits)
      expect(metadata.length).toBe(1)
      expect(metadata[0]).toEqual({
        type: 'fix',
        description: 'Fixed timezone bug in date picker'
      })
    })
  })

  describe('groupCommits', () => {
    it('returns object of metadata with conventional types as keys', () => {
      const metadata: helpers.CommitMetadata[] = [
        {
          type: 'fix',
          description: 'Fixed timezone bug in date picker'
        },
        {
          type: 'feat',
          description: 'Added more awesome date picker'
        },
        {
          type: 'feat',
          description: 'Added awesome date picker'
        }
      ]

      const groupedMetadata = helpers.groupCommits(metadata)
      expect(groupedMetadata).toEqual({
        fix: [
          {
            type: 'fix',
            description: 'Fixed timezone bug in date picker'
          }
        ],
        feat: [
          {
            type: 'feat',
            description: 'Added more awesome date picker'
          },
          {
            type: 'feat',
            description: 'Added awesome date picker'
          }
        ]
      })
    })
  })

  describe('createRelease', () => {
    const octokitMock = {
      rest: {
        repos: {
          createRelease: jest.fn()
        }
      }
    }

    const contextMock = {
      repo: {
        owner: 'test',
        repo: 'test'
      }
    } as unknown as Context

    it('returns the created release', async () => {
      octokitMock.rest.repos.createRelease.mockImplementation(async () => {
        return Promise.resolve({
          headers: {},
          status: 201,
          url: '',
          data: {
            html_url: 'https://example.com',
            name: 'test release',
            body: 'test release body'
          }
        } as CreateReleaseResponse)
      })

      const releaseTitle = 'test release'
      const releaseBody = 'test release body'
      const release = await helpers.createRelease(
        octokitMock as unknown as Octokit,
        contextMock,
        releaseTitle,
        releaseBody
      )
      expect(release).toEqual({
        html_url: 'https://example.com',
        name: 'test release',
        body: 'test release body'
      })
    })

    it('rethrows create release error if request fails', async () => {
      octokitMock.rest.repos.createRelease.mockImplementation(async () => {
        return Promise.reject(new Error('could not fetch error'))
      })

      const releaseTitle = 'test release'
      const releaseBody = 'test release body'
      await expect(
        helpers.createRelease(
          octokitMock as unknown as Octokit,
          contextMock,
          releaseTitle,
          releaseBody
        )
      ).rejects.toThrow('could not fetch error')
    })
  })
})
