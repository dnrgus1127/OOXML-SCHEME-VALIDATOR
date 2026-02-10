import type {
  Particle,
  SchemaRegistry,
  XsdAll,
  XsdChoice,
  XsdElement,
  XsdGroup,
  XsdGroupRef,
  XsdSequence,
} from '../types'
import { isAll, isAny, isChoice, isElement, isGroupRef, isSequence } from '../types'
import { CompositorState, FlattenedParticle, makeQualifiedName } from '../runtime'
import type { NamespaceResolver } from './compositor-types'

/**
 * Particle이 중첩된 compositor(sequence/choice/all)인지 확인합니다.
 * 중첩된 compositor는 내부에 추가 검증 로직이 필요한 컨테이너 구조입니다.
 *
 * @param particle - 검사할 particle (요소 또는 compositor)
 * @returns sequence, choice, all 중 하나면 true
 */
export function isNestedCompositor(particle: Particle | XsdElement): boolean {
  return isSequence(particle) || isChoice(particle) || isAll(particle)
}

/**
 * Particle이 특정 qualified name을 허용하는지 확인합니다.
 *
 * @param qualifiedName - 네임스페이스 URI와 로컬 이름이 결합된 전체 이름
 * @param particle - 확인할 particle
 * @param state - 현재 compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 해당 이름을 허용하면 true
 */
export function particleAllows(
  qualifiedName: string,
  particle: FlattenedParticle,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): boolean {
  if (particle.allowedNames?.has(qualifiedName)) {
    return true
  }

  if (isAny(particle.particle)) {
    return true
  }

  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const nested = getOrCreateNestedState(state, particle, registry, resolver)
    return nested.flattenedParticles.some((nestedParticle) =>
      nestedParticle.allowedNames?.has(qualifiedName)
    )
  }

  return false
}

export function getOrCreateNestedState(
  parent: CompositorState,
  particle: FlattenedParticle,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState {
  const cached = parent.nestedStates.get(particle.index)
  if (cached) {
    return cached
  }

  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const nested = createCompositorState(particle.particle, registry, resolver)
    parent.nestedStates.set(particle.index, nested)
    return nested
  }

  throw new Error('Invalid nested compositor state')
}

/** Reset a nested compositor state for a new occurrence (e.g., maxOccurs > 1) */
export function resetNestedState(
  parent: CompositorState,
  particle: FlattenedParticle,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState {
  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const fresh = createCompositorState(particle.particle, registry, resolver)
    parent.nestedStates.set(particle.index, fresh)
    return fresh
  }

  throw new Error('Invalid nested compositor state')
}

function createCompositorState(
  compositor: XsdSequence | XsdChoice | XsdAll,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState {
  const flattenedParticles = flattenParticles(
    compositor.kind === 'all' ? compositor.elements : compositor.particles,
    registry,
    resolver
  )

  return {
    kind: compositor.kind,
    flattenedParticles,
    currentIndex: 0,
    selectedBranch: null,
    appearedElements: new Set(),
    occurrenceCounts: new Map(),
    nestedStates: new Map(),
  }
}

export function flattenParticles(
  particles: Array<Particle | XsdElement>,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  startIndex = 0
): FlattenedParticle[] {
  const flattened: FlattenedParticle[] = []
  let index = startIndex

  for (const particle of particles) {
    if (isGroupRef(particle)) {
      const group = resolveGroup(particle, registry, resolver)
      if (group?.compositor) {
        const nested = flattenParticles(
          group.compositor.kind === 'all' ? group.compositor.elements : group.compositor.particles,
          registry,
          resolver,
          index
        )
        flattened.push(...nested)
        index += nested.length
        continue
      }
    }

    const allowedNames = buildAllowedNames(particle, registry, resolver)
    const occurs = getParticleOccurs(particle)

    flattened.push({
      index,
      particle,
      minOccurs: occurs.minOccurs,
      maxOccurs: occurs.maxOccurs,
      allowedNames,
    })
    index += 1
  }

  return flattened
}

export function buildAllowedNames(
  particle: Particle | XsdElement,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): Set<string> | undefined {
  if (isElement(particle)) {
    const name = particle.name ?? particle.ref?.name ?? ''
    const namespace = particle.ref?.namespacePrefix
      ? resolver.resolveNamespaceUri(particle.ref.namespacePrefix)
      : resolver.resolveNamespaceUri()
    return new Set([makeQualifiedName(namespace, name)])
  }

  if (isAll(particle)) {
    return new Set(
      particle.elements.map((element) => {
        const name = element.name ?? element.ref?.name ?? ''
        const namespace = element.ref?.namespacePrefix
          ? resolver.resolveNamespaceUri(element.ref.namespacePrefix)
          : resolver.resolveNamespaceUri()
        return makeQualifiedName(namespace, name)
      })
    )
  }

  if (isSequence(particle) || isChoice(particle)) {
    const nested = flattenParticles(particle.particles, registry, resolver)
    const names = new Set<string>()
    for (const entry of nested) {
      if (entry.allowedNames) {
        for (const name of entry.allowedNames) {
          names.add(name)
        }
      }
    }
    return names
  }

  if (isAny(particle)) {
    return undefined
  }

  if (isGroupRef(particle)) {
    const group = resolveGroup(particle, registry, resolver)
    if (group?.compositor) {
      return buildAllowedNames(group.compositor, registry, resolver)
    }
  }

  return new Set()
}

export function resolveGroupCompositor(
  groupRef: XsdGroupRef | undefined,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): XsdSequence | XsdChoice | XsdAll | undefined {
  if (!groupRef) {
    return undefined
  }

  const group = resolveGroup(groupRef, registry, resolver)
  return group?.compositor
}

export function resolveGroup(
  groupRef: XsdGroupRef,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): XsdGroup | undefined {
  const namespaceUri = groupRef.ref.namespacePrefix
    ? resolver.resolveNamespaceUri(groupRef.ref.namespacePrefix)
    : resolver.resolveNamespaceUri()
  return registry.resolveGroup(namespaceUri, groupRef.ref.name)
}

export function getParticleOccurs(particle: Particle | XsdElement): {
  minOccurs: number
  maxOccurs: number | 'unbounded'
} {
  if ('occurs' in particle) {
    return particle.occurs
  }

  return { minOccurs: 1, maxOccurs: 1 }
}

export function particleDescription(particle: FlattenedParticle): string {
  if (isElement(particle.particle)) {
    return particle.particle.name ?? particle.particle.ref?.name ?? 'element'
  }
  if (isGroupRef(particle.particle)) {
    return particle.particle.ref.name
  }
  return particle.particle.kind
}
