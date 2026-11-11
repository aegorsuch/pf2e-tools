export async function refreshApp() {
  if (navigator.onLine && 'serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
    if (registration) {
      await registration.update()
      const worker = registration.installing ?? registration.waiting
      if (worker && worker.state !== 'activated') {
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timer)
            worker.removeEventListener('statechange', changed)
          }
          const changed = () => {
            if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' })
            if (worker.state === 'activated') {
              cleanup()
              resolve()
            } else if (worker.state === 'redundant') {
              cleanup()
              reject(new Error('App update failed. Try refreshing again.'))
            }
          }
          const timer = setTimeout(() => {
            cleanup()
            reject(new Error('App update timed out. Try refreshing again.'))
          }, 15_000)
          worker.addEventListener('statechange', changed)
          changed()
        })
      }
    }
  }
  window.location.reload()
}
