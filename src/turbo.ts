// Turbo --dry=json output
export interface DryRunJson {
  id: string
  version: string
  turboVersion: string
  monorepo: boolean
  globalCacheInputs: {
    rootKey: string
    files: Record<string, string>
    hashOfExternalDependencies: string
  }
  packages: string[]
  envMode: string
  frameworkInference: boolean
  tasks: {
    taskId: string
    task: string
    package: string
    hash: string
    inputs: Record<string, string>
    hashOfExternalDependencies: string
    cache: {
      local: boolean
      remote: boolean
      status: string
      timeSaved: number
    }
    command: string
    cliArguments: string[]
    outputs: string[]
    logFile: string
    directory: string
    resolvedTaskDefinition: {
      outputs: string[]
      cache: boolean
      dependsOn: string[]
      outputMode: string
      persistent: boolean
    }
    framework: string
    envMode: string
  }[]
  user: string
  scm: {
    type: string
    sha: string
    branch: string
  }
}
