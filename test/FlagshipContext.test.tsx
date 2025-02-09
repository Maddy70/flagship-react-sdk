import { jest, expect, it, describe } from '@jest/globals'
// eslint-disable-next-line no-use-before-define
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { FlagshipProvider } from '../src/FlagshipContext'
import { SpyInstance, Mock } from 'jest-mock'
import { useFlagship } from '../src/FlagshipHooks'
import Flagship, { DecisionMode, Modification } from '@flagship.io/js-sdk'

function sleep (ms: number): Promise<unknown> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStart = Flagship.start as unknown as SpyInstance<any, unknown[]>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newVisitor = Flagship.newVisitor as unknown as SpyInstance<any, unknown[]>
const modifications = new Map<string, Modification>()

const synchronizeModifications = jest.fn()
const updateContext = jest.fn()
const unauthenticate = jest.fn()
const authenticate: Mock<void, [string]> = jest.fn()
const setConsent = jest.fn()
const clearContext = jest.fn()
const fetchFlags = jest.fn()

let onEventError = false

jest.mock('@flagship.io/js-sdk', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flagship = jest.requireActual('@flagship.io/js-sdk') as any

  const mockStart = jest.spyOn(flagship.Flagship, 'start')
  const newVisitor = jest.spyOn(flagship.Flagship, 'newVisitor')

  let fistStart = true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockStart.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_apiKey, _envId, { onBucketingUpdated, statusChangedCallback }: any) => {
      statusChangedCallback(1)
      statusChangedCallback(4)
      if (fistStart) {
        onBucketingUpdated(new Date())
        fistStart = false
      }
    }
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let OnReadyCallback: (error?: any) => void

  newVisitor.mockImplementation(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const EventOn: Mock<void, [string, (error?: any) => void]> = jest.fn()

    EventOn.mockImplementation((_e, callback) => {
      if (callback) {
        OnReadyCallback = callback
      }
    })

    synchronizeModifications.mockImplementation(async () => {
      await sleep(500)
      if (OnReadyCallback) {
        OnReadyCallback(onEventError ? new Error() : null)
      }
    })

    fetchFlags.mockImplementation(async () => {
      await sleep(500)
      if (OnReadyCallback) {
        OnReadyCallback(onEventError ? new Error() : null)
      }
    })

    const newVisitor = {
      anonymousId: '',
      synchronizeModifications,
      fetchFlags,
      on: EventOn,
      modifications,
      updateContext,
      unauthenticate,
      authenticate,
      setConsent,
      clearContext
    }

    authenticate.mockImplementation((visitorId) => {
      newVisitor.anonymousId = visitorId
    })
    unauthenticate.mockImplementation(() => {
      newVisitor.anonymousId = ''
    })

    newVisitor.fetchFlags()
    return newVisitor
  })

  return flagship
})

describe('Name of the group', () => {
  const visitorData = {
    id: 'visitor_id',
    context: {},
    isAuthenticated: false,
    hasConsented: true
  }
  const envId = 'EnvId'
  const apiKey = 'apiKey'
  const statusChangedCallback = jest.fn()
  const onInitStart = jest.fn()
  const onInitDone = jest.fn()
  const onUpdate = jest.fn()
  const onBucketingUpdated = jest.fn()

  it('should ', async () => {
    const props = {
      envId,
      apiKey,
      decisionMode: DecisionMode.DECISION_API,
      visitorData,
      statusChangedCallback,
      onInitStart,
      onInitDone,
      onUpdate,
      onBucketingUpdated,
      loadingComponent: <div></div>,
      fetchFlagsOnBucketingUpdated: true
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rerender } = render(
      <FlagshipProvider {...props}>
        <div>children</div>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(mockStart).toBeCalledTimes(1)
      expect(mockStart).toBeCalledWith(
        envId,
        apiKey,
        expect.objectContaining({
          decisionMode: DecisionMode.DECISION_API,
          onBucketingUpdated: expect.anything()
        })
      )
      expect(newVisitor).toBeCalledTimes(1)

      expect(newVisitor).toBeCalledWith({
        visitorId: visitorData.id,
        context: visitorData.context,
        isAuthenticated: visitorData.isAuthenticated,
        hasConsented: visitorData.hasConsented
      })

      expect(fetchFlags).toBeCalledTimes(1)
      expect(onBucketingUpdated).toBeCalledTimes(1)
      expect(statusChangedCallback).toBeCalledTimes(2)
      expect(onInitStart).toBeCalledTimes(1)
      expect(onInitDone).toBeCalledTimes(1)
      expect(onUpdate).toBeCalledTimes(1)
    })

    // Authenticate visitor
    rerender(
      <FlagshipProvider
        {...props}
        visitorData={{ ...props.visitorData, isAuthenticated: true }}
      >
        <div>children</div>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(mockStart).toBeCalledTimes(1)

      expect(newVisitor).toBeCalledTimes(2)

      expect(newVisitor).toBeCalledWith({
        visitorId: visitorData.id,
        context: visitorData.context,
        isAuthenticated: true,
        hasConsented: visitorData.hasConsented
      })

      expect(fetchFlags).toBeCalledTimes(2)
      expect(onBucketingUpdated).toBeCalledTimes(1)
      expect(statusChangedCallback).toBeCalledTimes(2)
      expect(onInitStart).toBeCalledTimes(1)
      expect(onInitDone).toBeCalledTimes(1)
      // expect(onUpdate).toBeCalledTimes(2);
    })

    // Unauthenticate visitor
    rerender(
      <FlagshipProvider
        {...props}
        visitorData={{ ...props.visitorData, isAuthenticated: false }}
      >
        <div>children</div>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(mockStart).toBeCalledTimes(1)
      expect(newVisitor).toBeCalledTimes(3)

      expect(newVisitor).toBeCalledWith({
        visitorId: visitorData.id,
        context: visitorData.context,
        isAuthenticated: false,
        hasConsented: visitorData.hasConsented
      })
    })

    // Update envId props
    rerender(
      <FlagshipProvider {...props} envId={'new_env_id'}>
        <div>children</div>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(mockStart).toBeCalledTimes(2)
      expect(mockStart).toBeCalledWith(
        'new_env_id',
        apiKey,
        expect.objectContaining({
          decisionMode: DecisionMode.DECISION_API,
          onBucketingUpdated: expect.anything()
        })
      )
      expect(newVisitor).toBeCalledTimes(4)
      expect(fetchFlags).toBeCalledTimes(4)
    })

    onEventError = true

    rerender(
      <FlagshipProvider {...props} envId={'new_env'}>
        <div>children</div>
      </FlagshipProvider>
    )
  })
})

describe('Test visitorData null', () => {
  const visitorData = {
    id: 'visitor_id',
    context: {},
    isAuthenticated: false,
    hasConsented: true
  }
  const envId = 'EnvId'
  const apiKey = 'apiKey'
  const statusChangedCallback = jest.fn()
  const onInitStart = jest.fn()
  const onInitDone = jest.fn()
  const onUpdate = jest.fn()
  const onBucketingUpdated = jest.fn()

  it('should ', async () => {
    const props = {
      envId,
      apiKey,
      decisionMode: DecisionMode.DECISION_API,
      visitorData: null,
      statusChangedCallback,
      onInitStart,
      onInitDone,
      onUpdate,
      onBucketingUpdated,
      loadingComponent: <div></div>,
      synchronizeOnBucketingUpdated: true
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rerender } = render(
      <FlagshipProvider {...props}>
        <div>children</div>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(mockStart).toBeCalledTimes(1)
      expect(mockStart).toBeCalledWith(
        envId,
        apiKey,
        expect.objectContaining({
          decisionMode: DecisionMode.DECISION_API,
          onBucketingUpdated: expect.anything()
        })
      )
      expect(newVisitor).toBeCalledTimes(0)

      expect(fetchFlags).toBeCalledTimes(0)
      expect(onBucketingUpdated).toBeCalledTimes(0)
      expect(statusChangedCallback).toBeCalledTimes(2)
      expect(onInitStart).toBeCalledTimes(1)
      expect(onInitDone).toBeCalledTimes(1)
      expect(onUpdate).toBeCalledTimes(0)
    })

    rerender(
      <FlagshipProvider {...props} visitorData={visitorData}>
        <div>children</div>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(mockStart).toBeCalledTimes(1)
      expect(mockStart).toBeCalledWith(
        envId,
        apiKey,
        expect.objectContaining({
          decisionMode: DecisionMode.DECISION_API,
          onBucketingUpdated: expect.anything()
        })
      )
      expect(newVisitor).toBeCalledTimes(1)

      expect(newVisitor).toBeCalledWith({
        visitorId: visitorData.id,
        context: visitorData.context,
        isAuthenticated: visitorData.isAuthenticated,
        hasConsented: visitorData.hasConsented
      })

      expect(fetchFlags).toBeCalledTimes(1)
      expect(onBucketingUpdated).toBeCalledTimes(0)
      expect(statusChangedCallback).toBeCalledTimes(2)
      expect(onInitStart).toBeCalledTimes(1)
      expect(onInitDone).toBeCalledTimes(1)
    })
  })
})

describe('Test initial data', () => {
  const visitorData = {
    id: 'visitor_id',
    context: {},
    isAuthenticated: false,
    hasConsented: true
  }
  const envId = 'EnvId'
  const apiKey = 'apiKey'

  const ChildComponent = () => {
    const fs = useFlagship()
    return <div>{fs.modifications.map(item => (<div data-testid={item.key} key={item.key}>{item.value}</div>))}</div>
  }

  it('test initialFlagsData ', async () => {
    const props = {
      envId,
      apiKey,
      decisionMode: DecisionMode.DECISION_API,
      visitorData,
      initialFlagsData: [
        {
          key: 'key1',
          campaignId: 'campaignId1',
          variationGroupId: 'variationGroupId2',
          variationId: 'variationId3',
          isReference: false,
          campaignType: 'ab',
          value: 'flagValue1'

        },
        {
          key: 'key2',
          campaignId: 'campaignId2',
          variationGroupId: 'variationGroupId2',
          variationId: 'variationId3',
          isReference: false,
          campaignType: 'ab',
          value: 'flagValue2'

        }
      ]
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { getByTestId } = render(
      <FlagshipProvider {...props}>
        <ChildComponent/>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(mockStart).toBeCalledTimes(1)
      expect(mockStart).toBeCalledWith(
        envId,
        apiKey,
        expect.objectContaining({
          decisionMode: DecisionMode.DECISION_API
        })
      )
      expect(newVisitor).toBeCalledTimes(1)
      expect(newVisitor).toBeCalledWith(expect.objectContaining({
        initialFlagsData: props.initialFlagsData
      }))

      expect(getByTestId('key1').textContent).toBe('flagValue1')
      expect(getByTestId('key2').textContent).toBe('flagValue2')
    })
  })

  it('test initialModifications ', async () => {
    const props = {
      envId,
      apiKey,
      decisionMode: DecisionMode.DECISION_API,
      visitorData,
      initialModifications: [
        {
          key: 'key1',
          campaignId: 'campaignId1',
          variationGroupId: 'variationGroupId2',
          variationId: 'variationId3',
          isReference: false,
          campaignType: 'ab',
          value: 'flagValue1'

        },
        {
          key: 'key2',
          campaignId: 'campaignId2',
          variationGroupId: 'variationGroupId2',
          variationId: 'variationId3',
          isReference: false,
          campaignType: 'ab',
          value: 'flagValue2'

        }
      ]
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { getByTestId } = render(
      <FlagshipProvider {...props}>
        <ChildComponent/>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(mockStart).toBeCalledTimes(1)
      expect(mockStart).toBeCalledWith(
        envId,
        apiKey,
        expect.objectContaining({
          decisionMode: DecisionMode.DECISION_API
        })
      )
      expect(newVisitor).toBeCalledTimes(1)
      expect(newVisitor).toBeCalledWith(expect.objectContaining({
        initialModifications: props.initialModifications
      }))
      expect(getByTestId('key1').textContent).toBe('flagValue1')
      expect(getByTestId('key2').textContent).toBe('flagValue2')
    })
  })

  it('test initialCampaigns ', async () => {
    const props = {
      envId,
      apiKey,
      decisionMode: DecisionMode.DECISION_API,
      visitorData,
      initialCampaigns: [
        {
          id: 'c1ndsu87m030114t8uu0',
          variationGroupId: 'c1ndta129mp0114nbtn0',
          variation: {
            id: 'c1ndta129mp0114nbtng',
            modifications: {
              type: 'FLAG',
              value: {
                background: 'rouge bordeau',
                btnColor: 'blue',
                keyBoolean: false,
                keyNumber: 558
              }
            },
            reference: false
          }
        }
      ]
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { getByTestId } = render(
      <FlagshipProvider {...props}>
        <ChildComponent/>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(newVisitor).toBeCalledTimes(1)
      expect(newVisitor).toBeCalledWith(expect.objectContaining({
        initialCampaigns: props.initialCampaigns
      }))

      expect(getByTestId('btnColor').textContent).toBe('blue')
    })
  })

  it('test initialCampaigns ', async () => {
    const ChildComponent = () => {
      const fs = useFlagship()
      return <div>
        <div data-testid="status">{String(fs.status.isSdkReady)}</div>
        <div data-testid="isLoading">{String(fs.status.isLoading)}</div>
      </div>
    }

    mockStart.mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_apiKey, _envId, { statusChangedCallback }: any) => {
        statusChangedCallback(0)
      }
    )

    const props = {
      envId,
      apiKey,
      decisionMode: DecisionMode.DECISION_API,
      visitorData
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { getByTestId } = render(
      <FlagshipProvider {...props}>
        <ChildComponent/>
      </FlagshipProvider>
    )

    await waitFor(() => {
      expect(newVisitor).toBeCalledTimes(0)
      expect(getByTestId('status').textContent).toEqual('false')
      expect(getByTestId('isLoading').textContent).toEqual('false')
    })
  })
})
