import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BridgeParams } from '@storyblok/preview-bridge'

// ---- mocks ----

const constructorMock = vi.fn()

vi.mock('@storyblok/preview-bridge', () => {
  class MockStoryblokBridge {
    constructor(config?: BridgeParams) {
      constructorMock(config)
    }
  }

  return {
    default: MockStoryblokBridge,
  }
})


describe('loadStoryblokBridge', () => {
  beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  })

  it('creates the bridge on first call', async () => {
      const { loadStoryblokBridge } = await import('./loadStoryblokBridge')

    const config: BridgeParams = { resolveRelations: ['foo.bar'] }

    const bridge = await loadStoryblokBridge(config)

    expect(bridge).toBeDefined()
    expect(constructorMock).toHaveBeenCalledOnce()
    expect(constructorMock).toHaveBeenCalledWith(config)
  })

  it('returns the same promise on subsequent calls with no config', async () => {
      const { loadStoryblokBridge } = await import('./loadStoryblokBridge')

    const first = await loadStoryblokBridge()
    const second = await loadStoryblokBridge()

    expect(first).toBe(second)
    expect(constructorMock).toHaveBeenCalledOnce()
  })

  it('returns the same promise when called with the same config reference', async () => {
      const { loadStoryblokBridge } = await import('./loadStoryblokBridge')

    const config: BridgeParams = { resolveRelations: ['foo.bar'] }

    const first = await loadStoryblokBridge(config)
    const second = await loadStoryblokBridge(config)

    expect(first).toBe(second)
    expect(constructorMock).toHaveBeenCalledOnce()
  })

  it('throws if called with a different config reference', async () => {
      const { loadStoryblokBridge } = await import('./loadStoryblokBridge')
    
    const configA: BridgeParams = { resolveRelations: ['foo.bar'] }
    const configB: BridgeParams = { resolveRelations: ['foo.bar'] } // same shape, different ref

    await loadStoryblokBridge(configA)

    expect(() => loadStoryblokBridge(configB)).toThrowError(
      '[Storyblok] Preview Bridge already initialized with a different configuration.',
    )

    expect(constructorMock).toHaveBeenCalledOnce()
  })

  it('resets internal state if import fails', async () => {
    vi.doMock('@storyblok/preview-bridge', () => {
      class FailingBridge {
        constructor() {
          throw new Error('boom')
        }
      }

      return { default: FailingBridge }
    })

    const { loadStoryblokBridge: failingLoader } = await import('./loadStoryblokBridge')

    await expect(failingLoader()).rejects.toThrow('boom')
    await expect(failingLoader()).rejects.toThrow('boom')
  })
})
