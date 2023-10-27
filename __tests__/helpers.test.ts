/**
 * Unit tests for src/wait.ts
 */
import * as github from '@actions/github'
import * as helpers from '../src/helpers'
import { expect } from '@jest/globals'
import { DeploymentsGraphQLResponse } from '../src/helpers'

type Octokit = ReturnType<typeof github.getOctokit>
type GetDeploymentResponse = Awaited<
  ReturnType<Octokit['rest']['repos']['getDeployment']>
>

const context = {
  owner: 'octocat',
  repo: 'Hello-World'
} as helpers.Context

const octokitMock = {
  rest: {
    repos: {
      getDeployment: jest.fn()
    }
  },
  graphql: jest.fn()
}

describe('helpers.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchDeployments', () => {
    it('should fetch a list of deployments', async () => {
      octokitMock.graphql.mockImplementation(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 1,
                    state: 'ACTIVE'
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: ''
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      const octokit = octokitMock as unknown as Octokit

      const deployments = await helpers.fetchDeployments(
        octokit,
        context,
        'production-my-app'
      )
      expect(deployments.nodes.length).toEqual(1)
      expect(deployments.nodes[0].databaseId).toEqual(1)
      expect(deployments.nodes[0].state).toEqual('ACTIVE')
    })
  })

  describe('fetchDeploymentStatus', () => {
    it('should return id if active deployment on first page', async () => {
      octokitMock.graphql.mockImplementation(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 1002,
                    state: 'Foo'
                  },
                  {
                    databaseId: 1001,
                    state: 'foo'
                  },
                  {
                    databaseId: 1000,
                    state: 'ACTIVE'
                  },
                  {
                    databaseId: 999,
                    state: 'Foo'
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: ''
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      const octokit = octokitMock as unknown as Octokit
      const deploymentId = await helpers.fetchDeploymentStatus(
        octokit,
        context,
        'production-my-app',
        1
      )
      expect(deploymentId).toEqual(1000)
    })

    it('should return null if no active deployments on first page and no more pages are available', async () => {
      octokitMock.graphql.mockImplementation(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 1002,
                    state: 'Foo'
                  },
                  {
                    databaseId: 1001,
                    state: 'foo'
                  },
                  {
                    databaseId: 999,
                    state: 'Foo'
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: ''
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      const octokit = octokitMock as unknown as Octokit
      const deploymentId = await helpers.fetchDeploymentStatus(
        octokit,
        context,
        'production-my-app',
        1
      )
      expect(deploymentId).toEqual(null)
    })

    it('should return id if active deployment on second page', async () => {
      // First page
      octokitMock.graphql.mockImplementationOnce(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 1002,
                    state: 'Foo'
                  },
                  {
                    databaseId: 1001,
                    state: 'foo'
                  },
                  {
                    databaseId: 1000,
                    state: 'Foo'
                  }
                ],
                pageInfo: {
                  hasNextPage: true,
                  endCursor: 'cursor'
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      // Second page
      octokitMock.graphql.mockImplementationOnce(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 999,
                    state: 'ACTIVE'
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: ''
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      const octokit = octokitMock as unknown as Octokit
      const deploymentId = await helpers.fetchDeploymentStatus(
        octokit,
        context,
        'production-my-app',
        1
      )

      expect(deploymentId).toEqual(999)
      expect(octokit.graphql).toHaveBeenCalledTimes(2)
      expect(octokit.graphql).toHaveBeenNthCalledWith(2, expect.anything(), {
        first: 20,
        cursor: 'cursor',
        environment: 'production-my-app',
        owner: context.owner,
        repo: context.repo
      })
    })

    it('should return null if no active deployments on second page and no more pages are available', async () => {
      // First page
      octokitMock.graphql.mockImplementationOnce(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 1002,
                    state: 'Foo'
                  },
                  {
                    databaseId: 1001,
                    state: 'foo'
                  },
                  {
                    databaseId: 1000,
                    state: 'Foo'
                  }
                ],
                pageInfo: {
                  hasNextPage: true,
                  endCursor: 'cursor'
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      // Second page
      octokitMock.graphql.mockImplementationOnce(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 999,
                    state: 'Foo'
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: ''
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      const octokit = octokitMock as unknown as Octokit
      const deploymentId = await helpers.fetchDeploymentStatus(
        octokit,
        context,
        'production-my-app',
        1
      )

      expect(deploymentId).toEqual(null)
      expect(octokit.graphql).toHaveBeenCalledTimes(2)
    })

    it('should return id for second active deployment if nth is 2', async () => {
      octokitMock.graphql.mockImplementation(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 1003,
                    state: 'Foo'
                  },
                  {
                    databaseId: 1002,
                    state: 'ACTIVE'
                  },
                  {
                    databaseId: 1001,
                    state: 'foo'
                  },
                  {
                    databaseId: 1000,
                    state: 'ACTIVE'
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: ''
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      const octokit = octokitMock as unknown as Octokit
      const deploymentId = await helpers.fetchDeploymentStatus(
        octokit,
        context,
        'production-my-app',
        2
      )
      expect(deploymentId).toEqual(1000)
    })

    it('should handle active number of deployments larger than nth', async () => {
      octokitMock.graphql.mockImplementation(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 1003,
                    state: 'Foo'
                  },
                  {
                    databaseId: 1002,
                    state: 'ACTIVE'
                  },
                  {
                    databaseId: 1001,
                    state: 'foo'
                  },
                  {
                    databaseId: 1000,
                    state: 'ACTIVE'
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: ''
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      const octokit = octokitMock as unknown as Octokit
      const deploymentId = await helpers.fetchDeploymentStatus(
        octokit,
        context,
        'production-my-app',
        1
      )
      expect(deploymentId).toEqual(1002)
    })

    it('should navigate to next page if nth is larger than number of deployments on first page', async () => {
      // First page
      octokitMock.graphql.mockImplementationOnce(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 1003,
                    state: 'Foo'
                  },
                  {
                    databaseId: 1002,
                    state: 'ACTIVE'
                  },
                  {
                    databaseId: 1001,
                    state: 'foo'
                  },
                  {
                    databaseId: 1000,
                    state: 'ACTIVE'
                  }
                ],
                pageInfo: {
                  hasNextPage: true,
                  endCursor: 'cursor'
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      // Second page
      octokitMock.graphql.mockImplementationOnce(async () => {
        return Promise.resolve({
          fetchDeployments: {
            repository: {
              deployments: {
                nodes: [
                  {
                    databaseId: 999,
                    state: 'Foo'
                  },
                  {
                    databaseId: 998,
                    state: 'ACTIVE'
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: ''
                }
              }
            }
          }
        } satisfies DeploymentsGraphQLResponse)
      })

      const octokit = octokitMock as unknown as Octokit
      const deploymentId = await helpers.fetchDeploymentStatus(
        octokit,
        context,
        'production-my-app',
        3
      )

      expect(deploymentId).toEqual(998)
      expect(octokit.graphql).toHaveBeenCalledTimes(2)
    })
  })

  describe('getDeploymentById', () => {
    it('should fetch a deployment by id', async () => {
      octokitMock.rest.repos.getDeployment.mockImplementation(async () => {
        return Promise.resolve({
          data: {
            created_at: '2021-01-01T00:00:00Z',
            id: 1234567890,
            sha: '1234567890'
          }
        } as unknown as GetDeploymentResponse)
      })

      const octokit = octokitMock as unknown as Octokit
      const deployment = await helpers.getDeploymentById(
        octokit,
        context,
        1234567890
      )

      expect(deployment.id).toEqual(1234567890)
      expect(deployment.sha).toEqual('1234567890')
      expect(deployment.created_at).toEqual('2021-01-01T00:00:00Z')
    })
  })
})
