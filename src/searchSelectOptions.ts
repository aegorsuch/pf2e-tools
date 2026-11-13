import { Children, Fragment, cloneElement, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from 'react'

function optionText(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child)
    ? optionText(child.props.children) : String(child)).join('')
}

export function selectOptionCount(children: ReactNode): number {
  return Children.toArray(children).reduce<number>((count, node) => {
    if (!isValidElement<ComponentPropsWithoutRef<'option'>>(node)) return count
    if (node.type === 'optgroup' || node.type === Fragment) return count + selectOptionCount(node.props.children)
    return count + Number(node.type === 'option' && String(node.props.value ?? optionText(node.props.children)) !== '')
  }, 0)
}

export function selectOptionList(children: ReactNode, group?: string, disabled = false): {
  value: string; label: string; disabled: boolean; group?: string
}[] {
  return Children.toArray(children).flatMap(node => {
    if (!isValidElement<ComponentPropsWithoutRef<'option'> & { label?: string }>(node)) return []
    if (node.type === Fragment) return selectOptionList(node.props.children, group, disabled)
    if (node.type === 'optgroup') return selectOptionList(node.props.children, node.props.label, disabled || !!node.props.disabled)
    if (node.type !== 'option') return []
    const text = optionText(node.props.children)
    return [{ value: String(node.props.value ?? text), label: node.props.label ?? text,
      disabled: disabled || !!node.props.disabled, group }]
  })
}

export function searchSelectOptions(children: ReactNode, query: string, value: string) {
  const q = query.trim().toLowerCase()
  let matches = 0
  const filter = (nodes: ReactNode): ReactNode => Children.toArray(nodes).flatMap(node => {
    if (!isValidElement<ComponentPropsWithoutRef<'option'> & { label?: string }>(node)) return []
    if (node.type === Fragment) return Children.toArray(filter(node.props.children))
    if (node.type === 'optgroup') {
      const options = filter(node.props.children)
      return Children.count(options) ? [cloneElement(node, {}, options)] : []
    }
    if (node.type !== 'option') return []
    const text = optionText(node.props.children)
    const key = String(node.props.value ?? text)
    const match = !q || `${node.props.label ?? text} ${key}`.toLowerCase().includes(q)
    if (key && match) matches++
    return !key || key === value || match ? [node] : []
  })
  return { children: filter(children), matches }
}
