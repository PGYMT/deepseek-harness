/**
 * Git branch management Remote for the dsh web surface.
 *
 * Executes git in the dsh repository root (the process working directory the
 * supervisor launches with), exposes branch inspection and mutation over a
 * Typert Remote, and requests a supervisor-managed restart (exit code 42 →
 * install + build → relaunch) after a branch switch.
 */

import { spawnSync } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-cmdline'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type { GitBranch, GitBranches, GitLogEntry, GitOpResult, GitStatus } from './types.ts'

export type * from './types.ts'

/** Supervisor protocol: switch branch → install + build → relaunch. */
const EXIT_REBUILD = 42

/** Result of one git subprocess invocation. */
interface GitRun {
  ok: boolean
  stdout: string
  stderr: string
}

/** Run git with args in the repo root, decoding output as UTF-8. */
function runGit(args: string[], cwd: string): GitRun {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/** Trimmed non-empty lines of a command's stdout. */
function lines(stdout: string): string[] {
  return stdout.split('\n').map(line => line.trim()).filter(line => line !== '')
}

/** Remote-only service exposing git repository state and actions. */
export class GitManagerGateway extends TypertRemoteService {
  static inject = ['appExit']

  /** The dsh repository root the supervisor launches the server in. */
  private readonly repo: string

  constructor(ctx: Context) {
    super(ctx, 'gitManager')
    this.repo = process.cwd()
  }

  @Remote('status')
  status(): GitStatus {
    const branchRun = runGit(['branch', '--show-current'], this.repo)
    const branch = branchRun.ok ? branchRun.stdout.trim() : ''

    const short = runGit(['status', '--short'], this.repo)
    const changes = short.ok ? lines(short.stdout) : []
    const clean = changes.length === 0

    let ahead = 0
    let behind = 0
    const sb = runGit(['status', '-sb'], this.repo)
    if (sb.ok) {
      const first = sb.stdout.split('\n')[0] ?? ''
      const aheadMatch = /\[ahead (\d+)/.exec(first)
      const behindMatch = /behind (\d+)/.exec(first)
      if (aheadMatch !== null) ahead = Number.parseInt(aheadMatch[1] ?? '0', 10)
      if (behindMatch !== null) behind = Number.parseInt(behindMatch[1] ?? '0', 10)
    }

    return { branch, clean, ahead, behind, changes }
  }

  @Remote('branches')
  branches(): GitBranches {
    const currentRun = runGit(['branch', '--show-current'], this.repo)
    const current = currentRun.ok ? currentRun.stdout.trim() : ''

    const branches: GitBranch[] = []
    const local = runGit(['branch'], this.repo)
    if (local.ok) {
      for (const line of local.stdout.split('\n')) {
        const name = line.replace(/^\*?\s*/, '').trim()
        if (name === '') continue
        branches.push({ name, current: name === current, remote: false })
      }
    }
    const remote = runGit(['branch', '-r'], this.repo)
    if (remote.ok) {
      for (const line of remote.stdout.split('\n')) {
        const name = line.trim()
        if (name === '' || name.includes('HEAD')) continue
        branches.push({ name, current: false, remote: true })
      }
    }

    return { current, branches }
  }

  @Remote('checkout')
  checkout(branch: string): GitOpResult {
    const result = runGit(['checkout', branch], this.repo)
    if (!result.ok) {
      return { ok: false, message: result.stderr.trim() || 'checkout 失败' }
    }
    this.restartSoon()
    return { ok: true, message: `已切换到 ${branch}，正在重启…` }
  }

  @Remote('create-branch')
  createBranch(name: string, base: string | null): GitOpResult {
    const args = ['checkout', '-b', name]
    if (base !== null && base.trim() !== '') args.push(base)
    const result = runGit(args, this.repo)
    if (!result.ok) {
      return { ok: false, message: result.stderr.trim() || '创建分支失败' }
    }
    this.restartSoon()
    return { ok: true, message: `已创建并切换到 ${name}，正在重启…` }
  }

  @Remote('push')
  push(branch: string): GitOpResult {
    const remotes = runGit(['remote'], this.repo)
    const hasMine = remotes.ok && lines(remotes.stdout).includes('mine')
    const remote = hasMine ? 'mine' : 'origin'
    const result = runGit(['push', '-u', remote, branch], this.repo)
    if (!result.ok) {
      return { ok: false, message: result.stderr.trim() || '推送失败' }
    }
    return { ok: true, message: `已推送到 ${remote}/${branch}` }
  }

  @Remote('commit')
  commit(message: string): GitOpResult {
    if (message.trim() === '') {
      return { ok: false, message: '提交信息不能为空' }
    }
    const add = runGit(['add', '-A'], this.repo)
    if (!add.ok) {
      return { ok: false, message: add.stderr.trim() || '暂存失败' }
    }
    const result = runGit(['commit', '-m', message], this.repo)
    if (!result.ok) {
      return { ok: false, message: result.stderr.trim() || '提交失败' }
    }
    return { ok: true, message: '提交成功' }
  }

  @Remote('pull')
  pull(): GitOpResult {
    const result = runGit(['pull'], this.repo)
    if (!result.ok) {
      return { ok: false, message: result.stderr.trim() || '拉取失败' }
    }
    return { ok: true, message: '拉取成功' }
  }

  @Remote('log')
  log(count: number): GitLogEntry[] {
    const n = Math.min(Math.max(Math.floor(count), 1), 50)
    const result = runGit(['log', '--oneline', '--decorate', '-n', String(n)], this.repo)
    const entries: GitLogEntry[] = []
    if (result.ok) {
      for (const line of result.stdout.split('\n')) {
        const trimmed = line.trim()
        if (trimmed === '') continue
        const match = /^([0-9a-f]+)\s*(?:\(([^)]*)\))?\s*(.*)$/.exec(trimmed)
        if (match !== null) {
          entries.push({ hash: match[1] ?? '', refs: match[2] ?? '', subject: match[3] ?? '' })
        }
      }
    }
    return entries
  }

  /** Defer exit so the Remote response reaches the client before teardown. */
  private restartSoon(): void {
    setTimeout(() => {
      this.ctx.appExit?.(EXIT_REBUILD)
    }, 250)
  }
}

export default GitManagerGateway
