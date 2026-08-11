import { getStorageHealth } from '@/lib/storage'
import StorageWarningBanner from './StorageWarningBanner'

// Server Component wrapper: reads storage health on the server and renders the
// shared banner. Renders nothing when storage is healthy, so it can be dropped
// at the top of any admin page unconditionally.
// Never render this on /onboarding, candidates must not see internal state.
export default function StorageWarning() {
  return <StorageWarningBanner health={getStorageHealth()} />
}
