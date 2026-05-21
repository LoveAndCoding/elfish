# @elfish/agents

## Role

`@elfish/agents` defines how elfish talks to agents.

It owns the adapter contracts and concrete agent integrations that know how to talk to specific agent providers. Workflows should depend on agent capabilities, not specific vendors or runtimes.

## Owns

- Agent adapter interfaces.
- Capability descriptions and matching.
- Concrete integrations for supported agents.
- Provider invocation contracts.
- Raw normalized adapter result shapes.

## Does Not Own

- Workflow orchestration.
- Workspace lifecycle.
- Project configuration syntax.
- UI or presentation concerns.
- Dispatcher policy.

## Public API

- Describe an agent's capabilities.
- Select agents by required capabilities.
- Invoke a provider through an adapter.
- Return raw normalized adapter results to the dispatcher.

## Depends On

- TypeScript.
- Bun runtime conventions used by the monorepo.
- Agent vendor SDKs only inside concrete integrations.

## Notes

Typical flow is runtime to dispatcher to agents. The dispatcher decides when to invoke an adapter and how to shape dispatch results. `@elfish/agents` defines what adapters look like and how provider-specific calls are normalized.
