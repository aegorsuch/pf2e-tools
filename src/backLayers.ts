type Layer = { id: number; close: () => void }

const stack: Layer[] = []
let nextId = 1
let ignored = 0
let listening = false

function onPop() {
  if (ignored > 0) { ignored--; return }
  const top = stack.at(-1)
  if (top && window.history.state?.pfLayer !== top.id) {
    stack.pop()
    top.close()
  }
}

// Registers an overlay so the browser/phone back button closes it before navigating further back
export function pushBackLayer(close: () => void) {
  if (typeof window === 'undefined') return () => {}
  if (!listening) { window.addEventListener('popstate', onPop); listening = true }
  const layer = { id: nextId++, close }
  stack.push(layer)
  window.history.pushState({ ...window.history.state, pfLayer: layer.id }, '')
  return () => {
    const index = stack.indexOf(layer)
    if (index < 0) return
    stack.splice(index, 1)
    ignored++
    window.history.back()
  }
}

export function watchNativeDialogs() {
  const released = new WeakMap<HTMLDialogElement, () => void>()
  const sync = (dialog: HTMLDialogElement, removed = false) => {
    const release = released.get(dialog)
    if (dialog.open && !removed && !release) released.set(dialog, pushBackLayer(() => dialog.close()))
    else if ((!dialog.open || removed) && release) { released.delete(dialog); release() }
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLDialogElement) sync(record.target)
      if (record.type === 'childList') record.removedNodes.forEach(node => {
        if (node instanceof HTMLDialogElement) sync(node, !node.isConnected)
        else if (node instanceof Element) node.querySelectorAll('dialog').forEach(item => sync(item, !item.isConnected))
      })
    }
  })
  observer.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true, childList: true })
  return () => observer.disconnect()
}
