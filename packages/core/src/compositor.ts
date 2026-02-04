import type {
  ElementContent,
  Particle,
  SchemaRegistry,
  XsdAll,
  XsdChoice,
  XsdComplexType,
  XsdElement,
  XsdGroup,
  XsdGroupRef,
  XsdSequence,
} from './types';
import {
  hasElementContent,
  isAll,
  isAny,
  isChoice,
  isElement,
  isGroupRef,
  isSequence,
} from './types';
import {
  CompositorState,
  FlattenedParticle,
  makeQualifiedName,
} from './runtime';

interface NamespaceResolver {
  resolveNamespaceUri(prefix?: string): string;
}

export function initCompositorState(
  schemaType: XsdComplexType | null,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): CompositorState | null {
  if (!schemaType || !hasElementContent(schemaType.content)) {
    return null;
  }

  const content = schemaType.content as ElementContent;
  const compositor = content.compositor ?? resolveGroupCompositor(content.groupRef, registry, resolver);
  if (!compositor) {
    return null;
  }

  return createCompositorState(compositor, registry, resolver);
}

export function createCompositorState(
  compositor: XsdSequence | XsdChoice | XsdAll,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): CompositorState {
  const flattenedParticles = flattenParticles(
    compositor.kind === 'all' ? compositor.elements : compositor.particles,
    registry,
    resolver,
  );

  return {
    kind: compositor.kind,
    flattenedParticles,
    currentIndex: 0,
    selectedBranch: null,
    appearedElements: new Set(),
    occurrenceCounts: new Map(),
    nestedStates: new Map(),
  };
}

export function validateCompositorChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): { success: boolean; errorCode?: string } {
  switch (state.kind) {
    case 'sequence':
      return validateSequenceChild(childNamespaceUri, childLocalName, state, registry, resolver);
    case 'choice':
      return validateChoiceChild(childNamespaceUri, childLocalName, state, registry, resolver);
    case 'all':
      return validateAllChild(childNamespaceUri, childLocalName, state, registry, resolver);
    default:
      return { success: false, errorCode: 'INVALID_CONTENT' };
  }
}

export function checkMissingRequiredElements(
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): string[] {
  const missing: string[] = [];

  if (state.kind === 'choice') {
    if (state.selectedBranch === null) {
      return missing;
    }

    const particle = state.flattenedParticles[state.selectedBranch];
    if (particle) {
      const count = state.occurrenceCounts.get(particle.index) ?? 0;
      if (count < particle.minOccurs) {
        missing.push(particleDescription(particle));
      }

      const nestedState = state.nestedStates.get(particle.index);
      if (nestedState) {
        missing.push(...checkMissingRequiredElements(nestedState, registry, resolver));
      }
    }

    return missing;
  }

  for (const particle of state.flattenedParticles) {
    const count = state.occurrenceCounts.get(particle.index) ?? 0;
    if (count < particle.minOccurs) {
      missing.push(particleDescription(particle));
      continue;
    }

    const nestedState = state.nestedStates.get(particle.index);
    if (nestedState) {
      missing.push(...checkMissingRequiredElements(nestedState, registry, resolver));
    }
  }

  return missing;
}

function validateSequenceChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): { success: boolean; errorCode?: string } {
  const qualifiedName = makeQualifiedName(childNamespaceUri, childLocalName);

  for (let i = state.currentIndex; i < state.flattenedParticles.length; i += 1) {
    const particle = state.flattenedParticles[i];
    if (!particle) continue;

    const canMatch = particleAllows(qualifiedName, particle, state, registry, resolver);

    if (canMatch) {
      const count = (state.occurrenceCounts.get(i) ?? 0) + 1;
      state.occurrenceCounts.set(i, count);
      if (particle.maxOccurs !== 'unbounded' && count > particle.maxOccurs) {
        return { success: false, errorCode: 'TOO_MANY_ELEMENTS' };
      }

      if (particle.maxOccurs !== 'unbounded' && count === particle.maxOccurs) {
        state.currentIndex = i + 1;
      } else {
        state.currentIndex = i;
      }

      return { success: true };
    }

    const count = state.occurrenceCounts.get(i) ?? 0;
    if (count < particle.minOccurs) {
      return { success: false, errorCode: 'MISSING_REQUIRED_ELEMENT' };
    }
  }

  return { success: false, errorCode: 'INVALID_ELEMENT' };
}

function validateChoiceChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): { success: boolean; errorCode?: string } {
  const qualifiedName = makeQualifiedName(childNamespaceUri, childLocalName);

  if (state.selectedBranch !== null) {
    const particle = state.flattenedParticles[state.selectedBranch];
    if (particle && particleAllows(qualifiedName, particle, state, registry, resolver)) {
      const count = (state.occurrenceCounts.get(state.selectedBranch) ?? 0) + 1;
      state.occurrenceCounts.set(state.selectedBranch, count);
      if (particle.maxOccurs !== 'unbounded' && count > particle.maxOccurs) {
        return { success: false, errorCode: 'TOO_MANY_ELEMENTS' };
      }
      return { success: true };
    }

    if (particle) {
      const count = state.occurrenceCounts.get(particle.index) ?? 0;
      if (count < particle.minOccurs) {
        return { success: false, errorCode: 'MISSING_REQUIRED_ELEMENT' };
      }
    }

    state.selectedBranch = null;
  }

  for (let i = 0; i < state.flattenedParticles.length; i += 1) {
    const particle = state.flattenedParticles[i];
    if (particle && particleAllows(qualifiedName, particle, state, registry, resolver)) {
      state.selectedBranch = i;
      state.occurrenceCounts.set(i, 1);
      return { success: true };
    }
  }

  return { success: false, errorCode: 'CHOICE_NOT_SATISFIED' };
}

function validateAllChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): { success: boolean; errorCode?: string } {
  const qualifiedName = makeQualifiedName(childNamespaceUri, childLocalName);

  const particle = state.flattenedParticles.find((entry) => entry.allowedNames?.has(qualifiedName));
  if (!particle) {
    return { success: false, errorCode: 'INVALID_ELEMENT' };
  }

  if (state.appearedElements.has(qualifiedName)) {
    return { success: false, errorCode: 'TOO_MANY_ELEMENTS' };
  }

  state.appearedElements.add(qualifiedName);
  const count = (state.occurrenceCounts.get(particle.index) ?? 0) + 1;
  state.occurrenceCounts.set(particle.index, count);

  if (particle.maxOccurs !== 'unbounded' && count > particle.maxOccurs) {
    return { success: false, errorCode: 'TOO_MANY_ELEMENTS' };
  }

  const nestedState = state.nestedStates.get(particle.index);
  if (nestedState) {
    return validateCompositorChild(childNamespaceUri, childLocalName, nestedState, registry, resolver);
  }

  return { success: true };
}

function particleAllows(
  qualifiedName: string,
  particle: FlattenedParticle,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): boolean {
  if (particle.allowedNames?.has(qualifiedName)) {
    return true;
  }

  if (isAny(particle.particle)) {
    return true;
  }

  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const nested = getOrCreateNestedState(state, particle, registry, resolver);
    return nested.flattenedParticles.some((nestedParticle) => nestedParticle.allowedNames?.has(qualifiedName));
  }

  return false;
}

function getOrCreateNestedState(
  parent: CompositorState,
  particle: FlattenedParticle,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): CompositorState {
  const cached = parent.nestedStates.get(particle.index);
  if (cached) {
    return cached;
  }

  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const nested = createCompositorState(particle.particle, registry, resolver);
    parent.nestedStates.set(particle.index, nested);
    return nested;
  }

  throw new Error('Invalid nested compositor state');
}

function flattenParticles(
  particles: Array<Particle | XsdElement>,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  startIndex = 0,
): FlattenedParticle[] {
  const flattened: FlattenedParticle[] = [];
  let index = startIndex;

  for (const particle of particles) {
    if (isGroupRef(particle)) {
      const group = resolveGroup(particle, registry, resolver);
      if (group?.compositor) {
        const nested = flattenParticles(
          group.compositor.kind === 'all' ? group.compositor.elements : group.compositor.particles,
          registry,
          resolver,
          index,
        );
        flattened.push(...nested);
        index += nested.length;
        continue;
      }
    }

    const allowedNames = buildAllowedNames(particle, registry, resolver);
    const occurs = getParticleOccurs(particle);

    flattened.push({
      index,
      particle,
      minOccurs: occurs.minOccurs,
      maxOccurs: occurs.maxOccurs,
      allowedNames,
    });
    index += 1;
  }

  return flattened;
}

function buildAllowedNames(
  particle: Particle | XsdElement,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): Set<string> | undefined {
  if (isElement(particle)) {
    const name = particle.name ?? particle.ref?.name ?? '';
    const namespace = particle.ref?.namespacePrefix
      ? resolver.resolveNamespaceUri(particle.ref.namespacePrefix)
      : resolver.resolveNamespaceUri();
    return new Set([makeQualifiedName(namespace, name)]);
  }

  if (isAll(particle)) {
    return new Set(
      particle.elements.map((element) => {
        const name = element.name ?? element.ref?.name ?? '';
        const namespace = element.ref?.namespacePrefix
          ? resolver.resolveNamespaceUri(element.ref.namespacePrefix)
          : resolver.resolveNamespaceUri();
        return makeQualifiedName(namespace, name);
      }),
    );
  }

  if (isSequence(particle) || isChoice(particle)) {
    const nested = flattenParticles(particle.particles, registry, resolver);
    const names = new Set<string>();
    for (const entry of nested) {
      if (entry.allowedNames) {
        for (const name of entry.allowedNames) {
          names.add(name);
        }
      }
    }
    return names;
  }

  if (isAny(particle)) {
    return undefined;
  }

  if (isGroupRef(particle)) {
    const group = resolveGroup(particle, registry, resolver);
    if (group?.compositor) {
      return buildAllowedNames(group.compositor, registry, resolver);
    }
  }

  return new Set();
}

function resolveGroupCompositor(
  groupRef: XsdGroupRef | undefined,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): XsdSequence | XsdChoice | XsdAll | undefined {
  if (!groupRef) {
    return undefined;
  }

  const group = resolveGroup(groupRef, registry, resolver);
  return group?.compositor;
}

function resolveGroup(
  groupRef: XsdGroupRef,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
): XsdGroup | undefined {
  const namespaceUri = groupRef.ref.namespacePrefix
    ? resolver.resolveNamespaceUri(groupRef.ref.namespacePrefix)
    : resolver.resolveNamespaceUri();
  return registry.resolveGroup(namespaceUri, groupRef.ref.name);
}

function getParticleOccurs(particle: Particle | XsdElement): { minOccurs: number; maxOccurs: number | 'unbounded' } {
  if ('occurs' in particle) {
    return particle.occurs;
  }

  return { minOccurs: 1, maxOccurs: 1 };
}

function particleDescription(particle: FlattenedParticle): string {
  if (isElement(particle.particle)) {
    return particle.particle.name ?? particle.particle.ref?.name ?? 'element';
  }
  if (isGroupRef(particle.particle)) {
    return particle.particle.ref.name;
  }
  return particle.particle.kind;
}
