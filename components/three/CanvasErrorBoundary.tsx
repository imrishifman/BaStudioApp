'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Catches render/runtime errors from the WebGL hero (lost context,
 * postprocessing failures, driver quirks) so a decorative 3D scene can
 * never crash the whole marketing page. Falls back to a static visual.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Hero canvas failed — showing fallback:', error)
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
