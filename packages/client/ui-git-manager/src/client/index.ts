/** Git management registered into Web Settings. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { GitManagerSettingsTab, type GitManagerSettingsTabInjected } from './GitManagerSettingsTab.tsx'
import { en, zh, type GitManagerLocaleKey } from './locales.ts'

export type { GitManagerSettingsTabInjected, GitManagerSettingsTabProps } from './GitManagerSettingsTab.tsx'
export type { GitManagerLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Git management copy. */
    'settings.gitManager': GitManagerLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.gitManager'

/** Services required by the Settings registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.gitManager']

/** Contribute the git manager tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-git-manager: dictionaries')

  const t = ctx.locale.bind(NS)

  const call = async <T>(
    fn: () => Promise<{ ok: true; value: T } | { ok: false; error: { code: string; message: string } }>,
  ): Promise<T> => {
    const result = await fn()
    if (!result.ok) {
      throw new Error(`gitManager failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }

  const injected = (): GitManagerSettingsTabInjected => ({
    status: () => call(() => ctx.remote.gitManager.status()),
    branches: () => call(() => ctx.remote.gitManager.branches()),
    checkout: branch => call(() => ctx.remote.gitManager.checkout(branch)),
    createBranch: (name, base) => call(() => ctx.remote.gitManager['create-branch'](name, base)),
    push: branch => call(() => ctx.remote.gitManager.push(branch)),
  })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'git',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, GitManagerSettingsTab))
}
