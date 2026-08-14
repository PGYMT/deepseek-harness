/** Git branch management Settings tab. */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GitBranch, GitBranches, GitOpResult, GitStatus } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './GitManagerSettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface GitManagerSettingsTabInjected {
  status: () => Promise<GitStatus>
  branches: () => Promise<GitBranches>
  checkout: (branch: string) => Promise<GitOpResult>
  createBranch: (name: string, base: string | null) => Promise<GitOpResult>
  push: (branch: string) => Promise<GitOpResult>
}

/** Full component props assembled by the Settings slot renderer. */
export type GitManagerSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.gitManager'>
  & InjectFace<GitManagerSettingsTabInjected>

type ViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; git: GitStatus; branches: GitBranches }

/** Render the Git branch management section. */
export function GitManagerSettingsTab(props: GitManagerSettingsTabProps): ReactNode {
  const { status: loadStatus, branches: loadBranches, checkout, createBranch, push, t } = props

  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [request, setRequest] = useState(0)
  const [name, setName] = useState('')
  const [base, setBase] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }, [])

  useEffect(() => {
    let current = true
    void Promise.all([loadStatus(), loadBranches()]).then(
      ([git, branches]) => {
        if (current) setState({ status: 'ready', git, branches })
      },
      (error: unknown) => {
        if (current) {
          setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      },
    )
    return () => { current = false }
  }, [loadStatus, loadBranches, request])

  const run = useCallback(async (action: () => Promise<GitOpResult>, successText: string): Promise<void> => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await action()
      setNotice(result.ok ? successText : `${t('operationFailed')}: ${result.message}`)
    } catch (error) {
      setNotice(`${t('operationFailed')}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }, [t])

  const localBranches = useMemo(() => (
    state.status === 'ready' ? state.branches.branches.filter(branch => !branch.remote) : []
  ), [state])
  const remoteBranches = useMemo(() => (
    state.status === 'ready' ? state.branches.branches.filter(branch => branch.remote) : []
  ), [state])

  const renderBranch = (branch: GitBranch): ReactNode => {
    if (branch.current) {
      return (
        <li key={branch.name} className={css.branchRow} data-current="true">
          <span className={css.branchName}>{branch.name}</span>
          <span className={css.currentTag}>{t('currentBranch')}</span>
        </li>
      )
    }
    return (
      <li key={branch.name} className={css.branchRow}>
        <span className={css.branchName} title={branch.name}>{branch.name}</span>
        <button
          type="button"
          className={css.switchButton}
          disabled={busy}
          onClick={() => { void run(() => checkout(branch.name), t('switchDone')) }}
        >
          {t('checkout')}
        </button>
      </li>
    )
  }

  if (state.status === 'loading') {
    return <div className={css.section} aria-busy="true"><p className={css.status}>{t('loading')}</p></div>
  }

  if (state.status === 'error') {
    return (
      <div className={css.section}>
        <p role="alert" className={css.status}>{t('error')}</p>
        <button type="button" onClick={reload}>{t('retry')}</button>
      </div>
    )
  }

  const { git } = state
  const branchLabel = git.branch === '' ? t('detached') : git.branch

  return (
    <div className={css.section}>
      <div className={css.summary}>
        <h3>{t('currentBranch')}</h3>
        <p className={css.branchHeading}>{branchLabel}</p>
        <p className={css.meta}>
          {git.clean ? t('clean') : t('dirty')}
          {git.changes.length > 0 ? ` · ${git.changes.length} ${t('changesLabel')}` : ''}
          {git.ahead > 0 || git.behind > 0
            ? ` · ${t('aheadLabel')} ${git.ahead} / ${t('behindLabel')} ${git.behind}`
            : ''}
        </p>
      </div>

      <div className={css.actions}>
        <button
          type="button"
          disabled={busy}
          onClick={() => { void run(() => push(git.branch === '' ? 'HEAD' : git.branch), t('pushDone')) }}
        >
          {t('pushCurrent')}
        </button>
        <button type="button" onClick={reload}>{t('refresh')}</button>
      </div>

      {notice !== null ? <p className={css.notice} role="status">{notice}</p> : null}

      <div className={css.create}>
        <h3>{t('newBranch')}</h3>
        <div className={css.createRow}>
          <input
            type="text"
            className={css.nameInput}
            placeholder={t('branchName')}
            value={name}
            onChange={(event) => { setName(event.currentTarget.value) }}
          />
          <input
            type="text"
            className={css.baseInput}
            placeholder={t('baseBranch')}
            value={base}
            onChange={(event) => { setBase(event.currentTarget.value) }}
          />
          <button
            type="button"
            disabled={busy || name.trim() === ''}
            onClick={() => {
              const target = name.trim()
              const baseValue = base.trim() === '' ? null : base.trim()
              setName('')
              setBase('')
              void run(() => createBranch(target, baseValue), t('switchDone'))
            }}
          >
            {t('create')}
          </button>
        </div>
      </div>

      <div className={css.lists}>
        <h3>{t('localBranches')}</h3>
        {localBranches.length === 0 ? <p className={css.status}>{t('noBranches')}</p> : <ul className={css.branchList}>{localBranches.map(renderBranch)}</ul>}

        <h3>{t('remoteBranches')}</h3>
        {remoteBranches.length === 0 ? <p className={css.status}>{t('noBranches')}</p> : <ul className={css.branchList}>{remoteBranches.map(renderBranch)}</ul>}
      </div>
    </div>
  )
}
